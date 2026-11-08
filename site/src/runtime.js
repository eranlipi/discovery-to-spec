/*
 * Runs the real discovery-to-spec CLI in the browser.
 * The build step (site/build.mjs) wraps src/*.js as modules and embeds the
 * templates; this file supplies what Node would: fs, path, process, console.
 * Everything lives in memory. Nothing leaves the page.
 */
function createD2sSandbox(bundle) {
  'use strict';

  var CWD = '/workspace';
  var files = new Map();
  var dirs = new Set(['/']);

  // ---------- path (POSIX subset) ----------

  function normalize(p) {
    var abs = p.charAt(0) === '/';
    var parts = [];
    p.split('/').forEach(function (seg) {
      if (!seg || seg === '.') return;
      if (seg === '..') {
        if (parts.length && parts[parts.length - 1] !== '..') parts.pop();
        else if (!abs) parts.push('..');
      } else parts.push(seg);
    });
    var out = (abs ? '/' : '') + parts.join('/');
    return out || (abs ? '/' : '.');
  }

  function resolve() {
    var r = '';
    for (var i = arguments.length - 1; i >= 0 && r.charAt(0) !== '/'; i--) {
      var a = arguments[i];
      if (!a) continue;
      r = r ? a + '/' + r : a;
    }
    if (r.charAt(0) !== '/') r = CWD + '/' + r;
    return normalize(r);
  }

  function dirname(p) {
    var n = normalize(p);
    if (n === '/') return '/';
    var i = n.lastIndexOf('/');
    if (i < 0) return '.';
    return i === 0 ? '/' : n.slice(0, i);
  }

  function basename(p, ext) {
    var b = normalize(p).split('/').pop() || '';
    return ext && b.slice(-ext.length) === ext ? b.slice(0, -ext.length) : b;
  }

  function relative(from, to) {
    var f = resolve(from).split('/').filter(Boolean);
    var t = resolve(to).split('/').filter(Boolean);
    var i = 0;
    while (i < f.length && i < t.length && f[i] === t[i]) i++;
    var up = [];
    for (var j = i; j < f.length; j++) up.push('..');
    return up.concat(t.slice(i)).join('/');
  }

  var pathShim = {
    sep: '/',
    normalize: normalize,
    resolve: resolve,
    join: function () {
      return normalize(Array.prototype.filter.call(arguments, Boolean).join('/'));
    },
    dirname: dirname,
    basename: basename,
    relative: relative,
    isAbsolute: function (p) { return p.charAt(0) === '/'; },
  };

  // ---------- fs (the sync subset the CLI uses) ----------

  function enoent(op, p) {
    var e = new Error("ENOENT: no such file or directory, " + op + " '" + p + "'");
    e.code = 'ENOENT';
    return e;
  }

  function mkdirp(p) {
    var d = resolve(p);
    while (!dirs.has(d)) {
      dirs.add(d);
      d = dirname(d);
    }
  }

  function writeFile(p, text) {
    var f = resolve(p);
    mkdirp(dirname(f));
    files.set(f, String(text));
  }

  function children(dir) {
    var d = resolve(dir);
    var prefix = d === '/' ? '/' : d + '/';
    var names = new Map();
    files.forEach(function (_v, f) {
      if (f.indexOf(prefix) === 0 && f.slice(prefix.length).indexOf('/') < 0) names.set(f.slice(prefix.length), 'file');
    });
    dirs.forEach(function (x) {
      if (x !== d && x.indexOf(prefix) === 0 && x.slice(prefix.length).indexOf('/') < 0) names.set(x.slice(prefix.length), 'dir');
    });
    return Array.from(names.entries()).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  }

  var fsShim = {
    existsSync: function (p) {
      var f = resolve(p);
      return files.has(f) || dirs.has(f);
    },
    readFileSync: function (p) {
      var f = resolve(p);
      if (!files.has(f)) throw enoent('open', p);
      return files.get(f);
    },
    writeFileSync: writeFile,
    mkdirSync: function (p) { mkdirp(p); },
    readdirSync: function (p, opts) {
      var d = resolve(p);
      if (!dirs.has(d)) throw enoent('scandir', p);
      var list = children(d);
      if (opts && opts.withFileTypes) {
        return list.map(function (e) {
          return {
            name: e[0],
            isDirectory: function () { return e[1] === 'dir'; },
            isFile: function () { return e[1] === 'file'; },
          };
        });
      }
      return list.map(function (e) { return e[0]; });
    },
    renameSync: function (a, b) {
      var from = resolve(a);
      var to = resolve(b);
      if (!files.has(from) && !dirs.has(from)) throw enoent('rename', a);
      var moveKey = function (k) { return to + k.slice(from.length); };
      Array.from(files.keys()).forEach(function (k) {
        if (k === from || k.indexOf(from + '/') === 0) {
          files.set(moveKey(k), files.get(k));
          files.delete(k);
        }
      });
      Array.from(dirs).forEach(function (k) {
        if (k === from || k.indexOf(from + '/') === 0) {
          dirs.delete(k);
          dirs.add(moveKey(k));
        }
      });
      mkdirp(dirname(to));
    },
    realpathSync: function (p) {
      var f = resolve(p);
      if (!files.has(f) && !dirs.has(f)) throw enoent('realpath', p);
      return f;
    },
  };

  // ---------- process & console ----------

  var out = [];
  function capture() {
    out.push(Array.prototype.map.call(arguments, String).join(' '));
  }
  var consoleShim = { log: capture, info: capture, warn: capture, error: capture };
  var processShim = {
    cwd: function () { return CWD; },
    env: { NO_COLOR: '1' },
    stdout: { isTTY: false },
    exitCode: 0,
    argv: [],
    platform: 'browser',
  };

  // ---------- modules ----------

  var cache = {};
  function load(fromDir, spec) {
    if (spec === 'node:fs' || spec === 'fs') return fsShim;
    if (spec === 'node:path' || spec === 'path') return pathShim;
    var full = resolve(fromDir, spec);
    if (cache[full]) return cache[full].exports;
    if (/\.json$/.test(full)) {
      cache[full] = { exports: JSON.parse(fsShim.readFileSync(full)) };
      return cache[full].exports;
    }
    var fn = bundle.modules[full];
    if (!fn) throw new Error('Cannot find module ' + spec);
    var module = { exports: {} };
    cache[full] = module;
    var dir = dirname(full);
    fn(module, module.exports, function (s) { return load(dir, s); }, dir, full, processShim, consoleShim);
    return module.exports;
  }

  Object.keys(bundle.files).forEach(function (rel) {
    writeFile('/pkg/' + rel, bundle.files[rel]);
  });
  writeFile('/pkg/package.json', JSON.stringify(bundle.pkg));
  mkdirp(CWD);

  var cli = load('/pkg/src', './cli.js');
  var lib = load('/pkg/src', './lib.js');

  function workspaceFiles() {
    var prefix = CWD + '/';
    return Array.from(files.keys())
      .filter(function (f) { return f.indexOf(prefix) === 0; })
      .map(function (f) { return f.slice(prefix.length); })
      .sort();
  }

  return {
    version: bundle.pkg.version,
    cwd: CWD,
    fs: fsShim,
    path: pathShim,
    lib: lib,
    /** Run `d2s <argv>`. Returns the exit code and the printed lines. `opts.columns` is the terminal width. */
    run: function (argv, opts) {
      out = [];
      processShim.stdout.columns = opts && opts.columns > 0 ? opts.columns : undefined;
      var code;
      try {
        code = cli.main(argv);
      } catch (e) {
        out.push('✖ ' + (e && e.message ? e.message : String(e)));
        code = 1;
      }
      return { code: code, lines: out.slice() };
    },
    files: workspaceFiles,
    read: function (rel) { return fsShim.readFileSync(CWD + '/' + rel); },
    write: function (rel, text) { writeFile(CWD + '/' + rel, text); },
    exists: function (rel) { return fsShim.existsSync(CWD + '/' + rel); },
    /** Empty the workspace, keeping the package. */
    reset: function () {
      var prefix = CWD + '/';
      Array.from(files.keys()).forEach(function (f) { if (f.indexOf(prefix) === 0) files.delete(f); });
      Array.from(dirs).forEach(function (d) { if (d.indexOf(prefix) === 0) dirs.delete(d); });
    },
  };
}
