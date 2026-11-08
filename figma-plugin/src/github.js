/*
 * GitHub access for the Figma plugin: read the design files on one branch and
 * save changes back as a single commit. REST API, fine-grained token.
 * It takes `fetch` as an option, so tests run it against a fake API.
 */
(function (root) {
  'use strict';

  function decodeBase64(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  /** Run `fn` over `items`, at most `limit` at a time. */
  function mapLimit(items, limit, fn) {
    var results = new Array(items.length);
    var next = 0;
    function worker() {
      if (next >= items.length) return Promise.resolve();
      var i = next++;
      return fn(items[i], i).then(function (r) {
        results[i] = r;
        return worker();
      });
    }
    var workers = [];
    for (var w = 0; w < Math.min(limit, items.length); w++) workers.push(worker());
    return Promise.all(workers).then(function () { return results; });
  }

  function explain(status, data, repo) {
    var detail = data && data.message ? ' (' + data.message + ')' : '';
    if (status === 401) return 'GitHub refused the token. Check that it is correct and has not expired.';
    if (status === 403) return 'The token is not allowed to do this. It needs "Contents: Read and write" on ' + repo + '.' + detail;
    if (status === 404) return 'GitHub could not find ' + repo + ', or the token cannot see it.';
    return 'GitHub answered ' + status + detail;
  }

  /**
   * opts: { repo: "owner/name", token, api?, fetch? }
   */
  function createClient(opts) {
    var api = (opts.api || 'https://api.github.com').replace(/\/+$/, '');
    var repo = opts.repo;
    var doFetch = opts.fetch || (typeof fetch === 'function' ? fetch.bind(root) : null);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) throw new Error('The repository should look like owner/name.');
    if (!opts.token) throw new Error('A GitHub token is needed.');

    function request(method, route, body) {
      var headers = { Authorization: 'Bearer ' + opts.token, Accept: 'application/vnd.github+json' };
      if (body) headers['Content-Type'] = 'application/json';
      return doFetch(api + '/repos/' + repo + route, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (!res.ok) {
            var err = new Error(explain(res.status, data, repo));
            err.status = res.status;
            throw err;
          }
          return data;
        });
      });
    }

    function refPath(branch) {
      return '/git/ref/heads/' + branch.split('/').map(encodeURIComponent).join('/');
    }

    /** The commit at the tip of `branch`, or null when the branch doesn't exist. */
    function head(branch) {
      return request('GET', refPath(branch)).then(
        function (ref) { return ref.object.sha; },
        function (err) { if (err.status === 404) return null; throw err; }
      );
    }

    /** Every file and folder in a commit: [{ path, type: "blob" | "tree", sha }]. */
    function entries(commitSha) {
      return request('GET', '/git/commits/' + commitSha)
        .then(function (c) { return request('GET', '/git/trees/' + c.tree.sha + '?recursive=1'); })
        .then(function (t) {
          if (t.truncated) throw new Error('The repository is too large to read in one go.');
          return t.tree.map(function (e) { return { path: e.path, type: e.type, sha: e.sha }; });
        });
    }

    function readBlob(sha) {
      return request('GET', '/git/blobs/' + sha).then(function (b) {
        return b.encoding === 'base64' ? decodeBase64(b.content) : b.content;
      });
    }

    /** { path: text } for the given blob entries, eight requests at a time. */
    function readFiles(list) {
      return mapLimit(list, 8, function (e) { return readBlob(e.sha); }).then(function (texts) {
        var files = {};
        list.forEach(function (e, i) { files[e.path] = texts[i]; });
        return files;
      });
    }

    function info() {
      return request('GET', '');
    }

    function createBranch(branch, fromSha) {
      return request('POST', '/git/refs', { ref: 'refs/heads/' + branch, sha: fromSha }).then(function () { return fromSha; });
    }

    /**
     * Commit `changes` ({ path: text }) to `branch` as one commit. `base` is the
     * commit the edits started from. If the branch moved since and someone else
     * changed one of the same files, nothing is written: the result lists those
     * paths in `conflicts`, with `theirs` holding their text. Paths in `overwrite`
     * are written anyway.
     * Returns { commit, conflicts: [], theirs: {} }.
     */
    function save(branch, base, changes, message, overwrite) {
      var paths = Object.keys(changes);
      overwrite = overwrite || [];
      return head(branch).then(function (tip) {
        if (!tip) throw new Error('The branch ' + branch + ' no longer exists on GitHub.');
        var check = tip === base
          ? Promise.resolve({ conflicts: [], theirs: {} })
          : Promise.all([entries(base), entries(tip)]).then(function (both) {
            var before = {};
            var after = {};
            both[0].forEach(function (e) { before[e.path] = e.sha; });
            both[1].forEach(function (e) { after[e.path] = e; });
            var moved = paths.filter(function (p) { return before[p] !== (after[p] && after[p].sha) && overwrite.indexOf(p) < 0; });
            var theirsList = moved.filter(function (p) { return after[p]; }).map(function (p) { return after[p]; });
            return readFiles(theirsList).then(function (theirs) {
              // Someone else's change that matches ours is no conflict.
              var conflicts = moved.filter(function (p) { return theirs[p] !== changes[p]; });
              return { conflicts: conflicts, theirs: theirs };
            });
          });
        return check.then(function (c) {
          if (c.conflicts.length) return { commit: null, head: tip, conflicts: c.conflicts, theirs: c.theirs };
          return request('GET', '/git/commits/' + tip)
            .then(function (commit) {
              return request('POST', '/git/trees', {
                base_tree: commit.tree.sha,
                tree: paths.map(function (p) { return { path: p, mode: '100644', type: 'blob', content: changes[p] }; }),
              });
            })
            .then(function (tree) { return request('POST', '/git/commits', { message: message, tree: tree.sha, parents: [tip] }); })
            .then(function (commit) {
              return request('PATCH', '/git/refs/heads/' + branch, { sha: commit.sha }).then(function () {
                return { commit: commit.sha, head: commit.sha, conflicts: [], theirs: {} };
              });
            });
        });
      });
    }

    return { info: info, head: head, entries: entries, readFiles: readFiles, createBranch: createBranch, save: save };
  }

  var api = { createClient: createClient, decodeBase64: decodeBase64 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.D2SGitHub = api;
})(typeof window !== 'undefined' ? window : globalThis);
