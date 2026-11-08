(function () {
  'use strict';

  var I18N = window.D2S_I18N;
  var D2S = window.D2S;
  var SAMPLES = window.D2S_SAMPLES || { en: {}, he: {} };
  var root = document.documentElement;
  var lang = 'en';

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  };
  function ui(key, forLang) {
    var l = forLang || lang;
    return (I18N[l] && I18N[l].ui && I18N[l].ui[key]) || I18N.en.ui[key];
  }

  // ---------- theme ----------

  var savedTheme = store.get('d2s-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') root.setAttribute('data-theme', savedTheme);
  var themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store.set('d2s-theme', next);
    });
  }

  // ---------- language ----------

  var metaDesc = document.querySelector('meta[name="description"]');
  var EN_META = { title: document.title, description: metaDesc ? metaDesc.getAttribute('content') : '' };

  function applyLang(next) {
    lang = next === 'he' ? 'he' : 'en';
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
      var he = I18N.he[el.getAttribute('data-i18n')];
      el.innerHTML = lang === 'he' && typeof he === 'string' ? he : el.dataset.en;
    });
    document.title = lang === 'he' ? I18N.he.meta.title : EN_META.title;
    if (metaDesc) metaDesc.setAttribute('content', lang === 'he' ? I18N.he.meta.description : EN_META.description);
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    store.set('d2s-lang', lang);
    if (sandboxReady) {
      renderChips();
      renderTree();
      if (!openFile) showEmptyEditor();
    }
  }

  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
  });

  // ---------- copy ----------

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-copy]') : null;
    if (!btn) return;
    var value = btn.getAttribute('data-copy');
    try { if (navigator.clipboard) navigator.clipboard.writeText(value); } catch (err) { /* clipboard blocked */ }
    var before = btn.innerHTML;
    btn.textContent = ui('copied');
    setTimeout(function () { btn.innerHTML = before; }, 1400);
  });

  // ---------- install tabs ----------

  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      var rtl = root.getAttribute('dir') === 'rtl';
      var step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      var next = tabs[(i + step + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });

  // ---------- sandbox ----------

  var out = document.getElementById('sb-out');
  var form = document.getElementById('sb-form');
  var input = document.getElementById('sb-input');
  var treeEl = document.getElementById('sb-tree');
  var editor = document.getElementById('sb-text');
  var pathEl = document.getElementById('sb-path');
  var chipsEl = document.getElementById('sb-chips');
  var resetBtn = document.getElementById('sb-reset');
  var sandboxReady = false;
  var openFile = null;
  var changed = {};
  var collapsedDefault = ['.claude', '.cursor', 'design/templates'];
  var collapsed = {};
  var history = [];
  var historyIndex = 0;
  var STAGE_FILES = ['brief.md', 'insights.md', 'options.md', 'decision.md', 'spec.md', 'handoff.md'];

  if (!D2S || !out) return applyLang(initialLang());

  function initialLang() {
    var param = /[?&]lang=(he|en)\b/.exec(window.location.search);
    return param ? param[1] : store.get('d2s-lang') || 'en';
  }

  function print(text, cls) {
    String(text).split('\n').forEach(function (part) {
      var div = document.createElement('div');
      div.className = cls || classify(part);
      div.textContent = part || ' ';
      out.appendChild(div);
    });
  }

  function classify(s) {
    var t = s.trim();
    var c = t.charAt(0);
    if (c === '✔' || /^created\b/.test(t)) return 'l-ok';
    if (c === '✖' || /^error\b/.test(t)) return 'l-err';
    if (c === '!' || c === '●' || /^(warn|updated)\b/.test(t)) return 'l-warn';
    if (c === '·' || /^kept\b/.test(t)) return 'l-dim';
    return '';
  }

  function tokenize(s) {
    var args = [];
    var cur = '';
    var quote = null;
    var started = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (quote) {
        if (ch === quote || (quote === '"' && ch === '”')) quote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'" || ch === '“') {
        quote = ch === '“' ? '”' : ch;
        started = true;
      } else if (/\s/.test(ch)) {
        if (cur || started) { args.push(cur); cur = ''; started = false; }
      } else {
        cur += ch;
      }
    }
    if (cur || started) args.push(cur);
    return args;
  }

  function snapshot() {
    var snap = {};
    D2S.files().forEach(function (f) { snap[f] = D2S.read(f); });
    return snap;
  }

  // ----- project state -----

  function project() {
    if (!D2S.exists('.d2s.json')) return null;
    try {
      var lib = D2S.lib;
      var ctx = lib.loadContext(D2S.cwd);
      var active = lib.listExplorations(ctx);
      var all = lib.listExplorations(ctx, { includeArchived: true });
      var state = { ctx: ctx, lang: ctx.lang, exp: null, hasArchived: all.length > active.length };
      if (!active.length) return state;
      var exp = active[active.length - 1];
      var i = lib.stageIndex(exp.stage);
      if (i < 0) return state;
      var stage = lib.STAGES[i];
      state.exp = exp;
      state.num = String(parseInt(exp.id, 10));
      state.stage = stage;
      state.doc = D2S.path.relative(D2S.cwd, D2S.path.join(exp.dir, stage.file));
      state.errors = lib.checkStageDoc(ctx, exp, stage).errors;
      state.approvalKey = lib.KEY_SECTIONS[ctx.lang].approvedBy;
      return state;
    } catch (e) {
      return null;
    }
  }

  function suggestions() {
    var p = project();
    if (!p) return [lang === 'he' ? 'd2s init --lang he' : 'd2s init', 'd2s help'];
    if (!p.exp) {
      var list = [p.lang === 'he'
        ? 'd2s new "נטישה בתהליך התשלום במובייל" --slug checkout'
        : 'd2s new "Checkout drop-off on mobile" --slug checkout'];
      if (p.hasArchived) list.push('d2s status --all');
      return list;
    }
    if (p.stage.id === 'handoff') return ['cat design/decisions.md', 'd2s status ' + p.num, 'd2s archive ' + p.num];
    if (!p.errors.length) return ['d2s next ' + p.num, 'd2s status ' + p.num];
    var onlyApproval = p.stage.id === 'decide' && p.errors.every(function (e) { return e.indexOf(p.approvalKey) >= 0; });
    if (onlyApproval) return ['d2s next ' + p.num, 'approve'];
    return ['fill', 'd2s next ' + p.num, 'd2s status ' + p.num];
  }

  function renderChips() {
    chipsEl.innerHTML = '';
    suggestions().forEach(function (cmd) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (cmd === 'fill' || cmd === 'approve' ? ' helper' : '');
      b.dir = 'ltr';
      b.textContent = cmd;
      b.addEventListener('click', function () { exec(cmd); });
      chipsEl.appendChild(b);
    });
  }

  // ----- file tree & editor -----

  function renderTree() {
    var files = D2S.files();
    treeEl.innerHTML = '';
    if (!files.length) {
      var empty = document.createElement('div');
      empty.className = 'tree-empty';
      empty.textContent = ui('treeEmpty');
      treeEl.appendChild(empty);
      return;
    }
    var top = { children: {} };
    files.forEach(function (f) {
      var parts = f.split('/');
      var node = top;
      parts.forEach(function (name, i) {
        var p = parts.slice(0, i + 1).join('/');
        if (!node.children[name]) node.children[name] = { name: name, path: p, file: i === parts.length - 1, children: {} };
        node = node.children[name];
      });
    });
    drawNode(top, 0);
  }

  function drawNode(node, depth) {
    Object.keys(node.children)
      .map(function (k) { return node.children[k]; })
      .sort(function (a, b) { return (a.file - b.file) || (a.name < b.name ? -1 : 1); })
      .forEach(function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.style.paddingInlineStart = 8 + depth * 14 + 'px';
        if (!n.file) {
          var closed = !!collapsed[n.path];
          b.className = 'dir';
          b.setAttribute('aria-expanded', String(!closed));
          b.textContent = (closed ? '▸ ' : '▾ ') + n.name + '/';
          b.addEventListener('click', function () {
            collapsed[n.path] = !closed;
            renderTree();
          });
          treeEl.appendChild(b);
          if (!closed) drawNode(n, depth + 1);
        } else {
          b.textContent = n.name;
          if (n.path === openFile) b.setAttribute('aria-current', 'true');
          if (changed[n.path]) b.classList.add('new');
          b.addEventListener('click', function () { openPath(n.path); });
          treeEl.appendChild(b);
        }
      });
  }

  function showEmptyEditor() {
    editor.value = '';
    editor.disabled = true;
    editor.placeholder = ui('editorEmpty');
    pathEl.textContent = '—';
  }

  function cleanPath(p) {
    return String(p || '').replace(/^(\.\/|~\/your-project\/|\/workspace\/)/, '').replace(/\/+$/, '');
  }

  function isFile(rel) {
    return D2S.files().indexOf(rel) >= 0;
  }

  function openPath(rel, quiet) {
    rel = cleanPath(rel);
    if (!isFile(rel)) {
      if (!quiet) print('open: ' + (rel || '<file>') + ': no such file', 'l-err');
      return;
    }
    openFile = rel;
    editor.disabled = false;
    editor.value = D2S.read(rel);
    var p = project();
    editor.dir = p && p.lang === 'he' && /\.md$/.test(rel) && rel.indexOf('design/') === 0 ? 'rtl' : 'ltr';
    pathEl.textContent = rel;
    // make sure the file is visible in the tree
    var parts = rel.split('/');
    for (var i = 1; i < parts.length; i++) collapsed[parts.slice(0, i).join('/')] = false;
    renderTree();
  }

  var chipTimer = null;
  editor.addEventListener('input', function () {
    if (!openFile) return;
    D2S.write(openFile, editor.value);
    clearTimeout(chipTimer);
    chipTimer = setTimeout(renderChips, 300);
  });

  // ----- after each command -----

  function afterChange(before) {
    var now = snapshot();
    changed = {};
    var touched = Object.keys(now).filter(function (f) { return before[f] !== now[f]; });
    touched.forEach(function (f) { changed[f] = true; });
    if (openFile && !(openFile in now)) openFile = null;

    var pick = null;
    var best = -1;
    touched.forEach(function (f) {
      var m = /explorations\/(?:archive\/)?\d{3,}-[^/]+\/([^/]+)$/.exec(f);
      var rank = m ? STAGE_FILES.indexOf(m[1]) : -1;
      if (rank > best) { best = rank; pick = f; }
    });
    if (!pick && changed['design/README.md'] && !('design/README.md' in before)) pick = 'design/README.md';
    if (!pick && changed['design/decisions.md']) pick = 'design/decisions.md';

    if (pick) openPath(pick, true);
    else if (openFile) {
      if (editor.value !== now[openFile]) editor.value = now[openFile];
      renderTree();
    } else {
      showEmptyEditor();
      renderTree();
    }
    renderChips();
  }

  // ----- sandbox shortcuts (not part of d2s) -----

  function fillDoc(rel, samples, opts) {
    var text = D2S.read(rel);
    var parts = text.split(/^(## .+)$/m);
    var filled = 0;
    for (var i = 1; i < parts.length; i += 2) {
      var key = parts[i].replace(/^##\s+/, '').replace(/\((optional|אופציונלי)\)/i, '').trim();
      var optional = /\((optional|אופציונלי)\)/i.test(parts[i]);
      var body = parts[i + 1] || '';
      var empty = !body.replace(/<!--[\s\S]*?-->/g, '').trim();
      var isApproval = key === opts.approvalKey;
      if (opts.only && key !== opts.only) continue;
      if (!opts.only && (isApproval || optional)) continue;
      if (!empty && !opts.only) continue;
      var value = opts.value || samples[key] || (opts.lang === 'he' ? 'טקסט לדוגמה.' : 'Example text.');
      var clean = opts.only ? body.replace(/^(\s*(<!--[\s\S]*?-->\s*)*)[\s\S]*$/, '$1') : body;
      parts[i + 1] = clean.replace(/\s*$/, '') + '\n' + value + '\n\n';
      filled++;
    }
    D2S.write(rel, parts.join('').replace(/\n{3,}$/, '\n'));
    return filled;
  }

  function fill() {
    var p = project();
    if (!p || !p.exp) {
      print('Nothing to fill yet. Start an exploration with d2s new.', 'l-dim');
      return;
    }
    if (p.stage.id === 'handoff') {
      print('The handoff is generated by d2s, so there is nothing to fill.', 'l-dim');
      return;
    }
    var samples = (SAMPLES[p.lang] || {})[p.stage.file] || {};
    var n = fillDoc(p.doc, samples, { approvalKey: p.approvalKey, lang: p.lang });
    if (!n) {
      print('Nothing to fill: every required section of ' + p.doc + ' already has text.', 'l-dim');
      return;
    }
    print('✔ Filled ' + n + ' empty section(s) of ' + p.doc + ' with example text.');
    print('  Sandbox shortcut. In a real project, your team writes this.', 'l-dim');
    if (p.stage.id === 'decide') {
      print('  "' + p.approvalKey + '" is left empty on purpose: run d2s next ' + p.num + ' to meet the gate.', 'l-dim');
    }
  }

  function approve(name) {
    var p = project();
    if (!p || !p.exp || p.stage.id !== 'decide') {
      print('Nothing to approve: no exploration is at the decision stage.', 'l-dim');
      return;
    }
    var who = name || ui('approver', p.lang);
    fillDoc(p.doc, {}, { approvalKey: p.approvalKey, only: p.approvalKey, value: who, lang: p.lang });
    print('✔ Recorded "' + p.approvalKey + ': ' + who + '" in ' + p.doc + '.');
    print('  Sandbox shortcut. In a real project, a real person approves. Now: d2s next ' + p.num, 'l-dim');
  }

  // ----- shell -----

  function listDir(rel) {
    var dir = cleanPath(rel);
    var full = D2S.cwd + (dir ? '/' + dir : '');
    try {
      var entries = D2S.fs.readdirSync(full, { withFileTypes: true }).map(function (e) {
        return e.name + (e.isDirectory() ? '/' : '');
      });
      print(entries.length ? entries.join('  ') : '(empty)', entries.length ? '' : 'l-dim');
    } catch (e) {
      print('ls: ' + (dir || '.') + ': no such directory', 'l-err');
    }
  }

  function cat(rel) {
    var f = cleanPath(rel);
    if (!isFile(f)) {
      print('cat: ' + (f || '<file>') + ': no such file', 'l-err');
      return;
    }
    print(D2S.read(f).replace(/\n$/, ''), 'l-dim');
  }

  function help() {
    print([
      'Commands in this sandbox:',
      '  d2s <command>    the real discovery-to-spec CLI (try: d2s help)',
      '  ls [dir]         list files',
      '  cat <file>       print a file',
      '  open <file>      open a file in the editor',
      '  fill             shortcut: write example text into the current doc',
      '  approve [name]   shortcut: record who approved the decision',
      '  clear            clear the screen',
      '  reset            start the project over',
    ].join('\n'), 'l-dim');
  }

  function exec(cmdline) {
    var s = String(cmdline).trim();
    if (!s) return;
    print(s, 'l-cmd');
    history.push(s);
    historyIndex = history.length;
    var argv = tokenize(s);
    if (argv[0] === 'npx' && /^(d2s|discovery-to-spec|github:eranlipi\/discovery-to-spec)$/.test(argv[1] || '')) {
      argv = ['d2s'].concat(argv.slice(2));
    }
    if (argv[0] === 'discovery-to-spec') argv[0] = 'd2s';
    var before = snapshot();
    switch (argv[0]) {
      case 'd2s':
        var args = argv.slice(1);
        // In the sandbox the command is just "d2s", so generated hints should say so too.
        if (args[0] === 'init' && args.indexOf('--cli') < 0) args = args.concat(['--cli', 'd2s']);
        var r = D2S.run(args);
        r.lines.forEach(function (l) { print(l); });
        break;
      case 'help': help(); break;
      case 'clear': out.innerHTML = ''; break;
      case 'ls': listDir(argv[1]); break;
      case 'cat': cat(argv[1]); break;
      case 'open': case 'edit': openPath(argv[1]); break;
      case 'fill': fill(); break;
      case 'approve': approve(argv.slice(1).join(' ')); break;
      case 'reset': resetSandbox(); return;
      default: print(argv[0] + ': command not found. Type help.', 'l-err');
    }
    afterChange(before);
    out.scrollTop = out.scrollHeight;
  }

  function welcome() {
    print('discovery-to-spec ' + D2S.version + ' is running in this page. Nothing leaves your browser.', 'l-dim');
    print('Pick a suggested command above, or type your own. Type help for the list.', 'l-dim');
  }

  function resetSandbox() {
    D2S.reset();
    openFile = null;
    changed = {};
    collapsed = {};
    collapsedDefault.forEach(function (p) { collapsed[p] = true; });
    out.innerHTML = '';
    welcome();
    showEmptyEditor();
    renderTree();
    renderChips();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value;
    input.value = '';
    exec(value);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
    } else if (e.key === 'ArrowDown' && history.length) {
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
    }
  });
  resetBtn.addEventListener('click', resetSandbox);

  sandboxReady = true;
  resetSandbox();
  applyLang(initialLang());
})();
