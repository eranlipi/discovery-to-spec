/*
 * The d2s Figma plugin's panel. It loads the design files from GitHub into an
 * in-memory d2s (the same core as the CLI), shows each stage as a form, and
 * saves changes back to GitHub as one commit per save. The Figma side
 * (code.js) handles the canvas and stores settings on this computer.
 */
(function () {
  'use strict';

  var Form = window.D2SForm;
  var GitHub = window.D2SGitHub;
  var app = document.getElementById('app');

  var TEXT = {
    en: {
      connectTitle: 'Connect to your project',
      connectIntro: 'The plugin reads and saves the design documents in your GitHub repository: the same Markdown files d2s uses.',
      repo: 'Repository',
      repoHint: 'owner/name, for example acme/checkout-app',
      branch: 'Branch',
      branchHint: 'Leave empty for the default branch. A new name creates that branch.',
      token: 'GitHub token',
      tokenHint: 'A fine-grained token for this repository only, with "Contents: Read and write". It is stored on this computer only.',
      createToken: 'Create a token on GitHub',
      advanced: 'Advanced',
      api: 'API address',
      apiHint: 'Only for GitHub Enterprise.',
      connect: 'Connect',
      loading: 'Loading the project…',
      noConfig: 'This branch has no .d2s.json. Ask a developer to run "d2s init" in the repository first.',
      branchCreated: 'Created the branch {branch}.',
      explorations: 'Explorations',
      newExploration: 'New exploration',
      refresh: 'Refresh',
      disconnect: 'Disconnect',
      inThisFile: 'In this file',
      none: 'No explorations yet. Start one for the problem you are working on.',
      stages: ['Frame', 'Research', 'Options', 'Decide', 'Spec', 'Handoff'],
      stageOf: 'Stage {n} of 6',
      owner: 'Owner',
      title: 'Title',
      titleHint: 'The problem, not the solution. For example "Checkout drop-off on mobile".',
      slug: 'Folder name',
      slugHint: 'Latin letters, for example checkout. Needed when the title has none.',
      start: 'Start exploration',
      cancel: 'Cancel',
      back: 'All explorations',
      attach: 'Attach selected frames',
      attachN: 'Attach {n} selected',
      attachHint: 'Select frames on the canvas and click the field they belong to.',
      pickField: 'Click the field the frames belong to, then attach.',
      fileLinkTitle: 'Paste this file’s link once',
      fileLinkHint: 'In Figma: Share, then Copy link. The plugin needs it to build links to frames.',
      fileLinkSave: 'Save link',
      badFileLink: 'That isn’t a Figma file link.',
      showOnCanvas: 'Show on canvas',
      pasteButton: 'Paste from AI',
      pasteTitle: 'Paste the document your AI assistant wrote for this stage',
      pasteHint: 'Each "## heading" fills the field with the same name. Fields without a matching heading stay as they are.',
      pasteApply: 'Fill the fields',
      pasteFilled: 'Filled from the AI document: {fields}.',
      pasteIgnored: ' Not used: {headings}.',
      pasteSkipped: ' "{fields}" is left for people to fill in.',
      pasteNothing: 'No heading in the text matches this stage\u2019s fields. Ask the assistant for the document with the stage\u2019s headings.',
      notFound: 'That frame isn’t in this file anymore.',
      next: 'Next stage',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved to project {when}',
      unsaved: 'Unsaved changes',
      upToDate: 'Everything is saved',
      justNow: 'just now',
      minutesAgo: '{n} min ago',
      gate: 'The gate stopped here. Finish these, then press Next stage again:',
      gateClear: 'Everything is filled in. Press Next stage.',
      empty: '{label} is still empty',
      missingSection: '{label} is missing from the document',
      moved: 'Passed the gate. Next: {stage}.',
      decided: 'Decision recorded in decisions.md. Next: {stage}.',
      handoffReady: 'Two documents were generated: a summary for design and product, and a handoff for developers.',
      done: 'This stage passed. Its document stays in the repo as {file}.',
      optional: 'optional',
      name: 'Name',
      role: 'Role',
      addPerson: 'Add a person',
      remove: 'Remove',
      approvalNote: 'Write who approved: one row per person. Only people approve, never an AI tool.',
      docSummary: 'For design and product',
      docHandoff: 'For developers',
      summaryIntro: 'Stage 6 of 6. For design and product: the whole exploration on one page.',
      handoffIntro: 'Stage 6 of 6. For developers: the chosen direction, its frames and the acceptance criteria.',
      copyLink: 'Copy link for developers',
      copied: 'Link copied',
      conflictTitle: 'Someone else saved changes to these files since you opened them:',
      keepMine: 'Keep mine',
      takeTheirs: 'Take theirs',
      draftConflict: 'Your unsaved draft of {file} is older than the version on GitHub. Keep your draft?',
      saveError: 'Couldn’t save: {error} Your changes are kept on this computer.',
      nothingToSave: 'Nothing to save.',
      commitEdit: '{id}: {stage} updated by {user} via d2s plugin',
      commitNext: '{id}: {from} → {to} by {user} via d2s plugin',
      commitNew: '{id}: started by {user} via d2s plugin',
      someone: 'a designer',
    },
    he: {
      connectTitle: 'חיבור לפרויקט',
      connectIntro: 'התוסף קורא ושומר את מסמכי העיצוב ב-repo ב-GitHub: אותם קבצי Markdown ש-d2s עובד איתם.',
      repo: 'Repository',
      repoHint: 'owner/name, למשל acme/checkout-app',
      branch: 'Branch',
      branchHint: 'ריק = ה-branch הראשי. שם חדש ייצור branch חדש.',
      token: 'טוקן GitHub',
      tokenHint: 'טוקן fine-grained ל-repo הזה בלבד, עם "Contents: Read and write". הוא נשמר רק במחשב הזה.',
      createToken: 'ליצור טוקן ב-GitHub',
      advanced: 'מתקדם',
      api: 'כתובת API',
      apiHint: 'רק ל-GitHub Enterprise.',
      connect: 'להתחבר',
      loading: 'טוען את הפרויקט…',
      noConfig: 'ב-branch הזה אין .d2s.json. בקשו ממפתח להריץ "d2s init" ב-repo קודם.',
      branchCreated: 'נוצר ה-branch {branch}.',
      explorations: 'תהליכים',
      newExploration: 'תהליך חדש',
      refresh: 'לרענן',
      disconnect: 'להתנתק',
      inThisFile: 'בקובץ הזה',
      none: 'עדיין אין תהליכים. פתחו אחד לבעיה שאתם עובדים עליה.',
      stages: ['מסגור', 'חקר', 'כיוונים', 'החלטה', 'מפרט', 'העברה'],
      stageOf: 'שלב {n} מתוך 6',
      owner: 'מי מוביל',
      title: 'שם',
      titleHint: 'הבעיה, לא הפתרון. למשל "נטישה בתהליך התשלום במובייל".',
      slug: 'שם תיקייה',
      slugHint: 'באותיות לטיניות, למשל checkout. חובה כשבשם אין אותיות לטיניות.',
      start: 'לפתוח תהליך',
      cancel: 'ביטול',
      back: 'כל התהליכים',
      attach: 'לצרף frames מסומנים',
      attachN: 'לצרף {n} מסומנים',
      attachHint: 'מסמנים frames על הקנבס ולוחצים על השדה שהם שייכים אליו.',
      pickField: 'לחצו קודם על השדה שה-frames שייכים אליו, ואז צרפו.',
      fileLinkTitle: 'הדביקו פעם אחת את הקישור לקובץ',
      fileLinkHint: 'ב-Figma: Share ואז Copy link. התוסף צריך אותו כדי לבנות קישורים ל-frames.',
      fileLinkSave: 'לשמור קישור',
      badFileLink: 'זה לא קישור לקובץ Figma.',
      showOnCanvas: 'להציג בקנבס',
      pasteButton: 'הדבקה מ-AI',
      pasteTitle: 'מדביקים את המסמך שהעוזר כתב לשלב הזה',
      pasteHint: 'כל כותרת "##" ממלאת את השדה עם אותו שם. שדות בלי כותרת מתאימה נשארים כמו שהם.',
      pasteApply: 'למלא את השדות',
      pasteFilled: 'מולא מהמסמך: {fields}.',
      pasteIgnored: ' לא נכנסו: {headings}.',
      pasteSkipped: ' את "{fields}" ממלאים אנשים בעצמם.',
      pasteNothing: 'אף כותרת בטקסט לא מתאימה לשדות של השלב הזה. בקשו מהעוזר את המסמך עם הכותרות של השלב.',
      notFound: 'ה-frame הזה כבר לא בקובץ.',
      next: 'לשלב הבא',
      save: 'לשמור',
      saving: 'שומר…',
      saved: 'נשמר בפרויקט {when}',
      unsaved: 'יש שינויים שלא נשמרו',
      upToDate: 'הכל שמור',
      justNow: 'עכשיו',
      minutesAgo: 'לפני {n} דקות',
      gate: 'השער עצר כאן. משלימים את אלה ולוחצים שוב על "לשלב הבא":',
      gateClear: 'הכל מלא. אפשר ללחוץ על "לשלב הבא".',
      empty: '"{label}" עדיין ריק',
      missingSection: '"{label}" חסר במסמך',
      moved: 'עברתם את השער. השלב הבא: {stage}.',
      decided: 'ההחלטה נרשמה ב-decisions.md. השלב הבא: {stage}.',
      handoffReady: 'נוצרו שני מסמכים: סיכום לעיצוב ולמוצר, ומסמך העברה למפתחים.',
      done: 'השלב הזה עבר. הוא נשאר ב-repo בקובץ {file}.',
      optional: 'אופציונלי',
      name: 'שם',
      role: 'תפקיד',
      addPerson: 'להוסיף אדם',
      remove: 'להסיר',
      approvalNote: 'כותבים מי אישר: שורה לכל אדם. רק אנשים מאשרים, לא כלי AI.',
      docSummary: 'לעיצוב ולמוצר',
      docHandoff: 'למפתחים',
      summaryIntro: 'שלב 6 מתוך 6. לעיצוב ולמוצר: כל התהליך בעמוד אחד.',
      handoffIntro: 'שלב 6 מתוך 6. למפתחים: הכיוון שנבחר, ה-frames שלו וקריטריוני הקבלה.',
      copyLink: 'להעתיק קישור למפתחים',
      copied: 'הקישור הועתק',
      conflictTitle: 'מישהו אחר שמר שינויים בקבצים האלה מאז שפתחתם אותם:',
      keepMine: 'לשמור את שלי',
      takeTheirs: 'לקחת את שלהם',
      draftConflict: 'הטיוטה שלא נשמרה של {file} ישנה יותר מהגרסה ב-GitHub. לשמור את הטיוטה?',
      saveError: 'לא הצלחתי לשמור: {error} השינויים נשמרו במחשב הזה.',
      nothingToSave: 'אין מה לשמור.',
      commitEdit: '{id}: {stage} עודכן על ידי {user} דרך התוסף של d2s',
      commitNext: '{id}: {from} → {to} על ידי {user} דרך התוסף של d2s',
      commitNew: '{id}: נפתח על ידי {user} דרך התוסף של d2s',
      someone: 'מעצב/ת',
    },
  };

  var S = {
    lang: 'en',
    screen: 'loading',
    user: '',
    fileKey: '',
    fileName: '',
    fileUrl: '',
    linked: [],
    selection: [],
    drafts: {},
    settings: null,
    client: null,
    d2s: null,
    base: null, // { head, files } as on GitHub
    expId: null,
    view: null,
    gateShown: false,
    notice: null,
    finalDoc: 'summary',
    saving: false,
    savedAt: null,
    conflicts: null, // { paths, theirs }
    overwrite: [],
    draftConflicts: [],
    lastField: null,
    pasteOpen: false,
    form: null,
    error: '',
  };

  // ---------- the bridge to code.js ----------

  var pending = {};
  var seq = 0;
  function call(type, data) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject };
      var msg = { type: type, id: id };
      Object.keys(data || {}).forEach(function (k) { msg[k] = data[k]; });
      parent.postMessage({ pluginMessage: msg }, '*');
    });
  }
  window.addEventListener('message', function (e) {
    var m = e.data && e.data.pluginMessage;
    if (!m) return;
    if (m.type === 'reply' && pending[m.id]) {
      if (m.error) pending[m.id].reject(new Error(m.error));
      else pending[m.id].resolve(m.result);
      delete pending[m.id];
    } else if (m.type === 'selection') {
      S.selection = m.nodes || [];
      drawAttach();
    }
  });

  // ---------- helpers ----------

  function t(key, vars) {
    var s = (TEXT[S.lang] && TEXT[S.lang][key]) !== undefined ? TEXT[S.lang][key] : TEXT.en[key];
    if (typeof s !== 'string') return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? vars[k] : m; });
  }

  /** h('div.class', { attr }, children...) */
  function h(spec, attrs) {
    var parts = spec.split('.');
    var node = document.createElement(parts[0] || 'div');
    if (parts.length > 1) node.className = parts.slice(1).join(' ');
    var kids = Array.prototype.slice.call(arguments, 2);
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) {
      kids.unshift(attrs);
      attrs = null;
    }
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), v);
      else if (k === 'text') node.textContent = v;
      else if (k === 'value') node.value = v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {
      list.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) add(c);
        else node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    })(kids);
    return node;
  }

  function notify(text, error) {
    call('notify', { text: text, error: !!error }).catch(function () {});
  }

  function draftKey() {
    return S.settings.repo + '#' + S.settings.branch;
  }

  function ctx() {
    return S.d2s.lib.loadContext(S.d2s.cwd);
  }

  function exploration() {
    var c = ctx();
    var exp = S.d2s.lib.listExplorations(c).filter(function (e) { return e.id === S.expId; })[0];
    if (!exp) return null;
    var index = S.d2s.lib.stageIndex(exp.stage);
    return { ctx: c, exp: exp, index: index, stage: S.d2s.lib.STAGES[index] };
  }

  function relPath(abs) {
    return S.d2s.path.relative(S.d2s.cwd, abs);
  }

  // ---------- loading from GitHub ----------

  function wanted(path, dir) {
    if (path === '.d2s.json' || path === dir + '/decisions.md') return true;
    if (path.indexOf(dir + '/templates/') === 0) return /\.md$/.test(path);
    if (path.indexOf(dir + '/explorations/') === 0) {
      var rest = path.slice(dir.length + '/explorations/'.length).split('/');
      return rest.length === 2 && rest[0] !== 'archive' && /\.md$/.test(rest[1]);
    }
    return /^openspec\/changes\/[^/]+\/proposal\.md$/.test(path);
  }

  function connect(settings) {
    S.screen = 'loading';
    S.error = '';
    S.attempt = settings; // so a failed attempt keeps what was typed
    render();
    var client;
    try {
      client = GitHub.createClient({ repo: settings.repo, token: settings.token, api: settings.api });
    } catch (e) {
      return fail(e);
    }
    var branchNote = '';
    var branch = settings.branch;
    var resolve = branch ? Promise.resolve(branch) : client.info().then(function (r) { return r.default_branch; });
    return resolve
      .then(function (b) {
        branch = b;
        return client.head(branch).then(function (sha) {
          if (sha) return sha;
          return client.info()
            .then(function (r) { return client.head(r.default_branch); })
            .then(function (from) {
              branchNote = branch; // worded below, once the project's language is known
              return client.createBranch(branch, from);
            });
        });
      })
      .then(function (head) {
        return client.entries(head).then(function (entries) {
          var cfg = entries.filter(function (e) { return e.path === '.d2s.json' && e.type === 'blob'; })[0];
          if (!cfg) throw new Error(t('noConfig'));
          return client.readFiles([cfg]).then(function (one) {
            var config = JSON.parse(one['.d2s.json']);
            var dir = (config.dir || 'design').replace(/\/+$/, '');
            var blobs = entries.filter(function (e) { return e.type === 'blob' && e.path !== '.d2s.json' && wanted(e.path, dir); });
            var dirs = entries.filter(function (e) {
              return e.type === 'tree' && (e.path.indexOf(dir + '/explorations') === 0 || e.path === 'openspec');
            });
            return client.readFiles(blobs).then(function (files) {
              files['.d2s.json'] = one['.d2s.json'];
              return { head: head, files: files, dirs: dirs.map(function (d) { return d.path; }) };
            });
          });
        });
      })
      .then(function (snap) {
        var d2s = window.D2S_NEW();
        snap.dirs.forEach(function (d) { d2s.fs.mkdirSync(d2s.cwd + '/' + d); });
        Object.keys(snap.files).forEach(function (p) { d2s.write(p, snap.files[p]); });
        S.d2s = d2s;
        S.client = client;
        S.base = { head: snap.head, files: snap.files };
        S.settings = { repo: settings.repo, branch: branch, token: settings.token, api: settings.api || '' };
        S.attempt = null;
        S.lang = ctx().lang === 'he' ? 'he' : 'en';
        applyDrafts();
        S.screen = S.expId && exploration() ? 'exp' : 'home';
        S.notice = branchNote ? { kind: 'ok', text: t('branchCreated', { branch: branchNote }) } : S.notice;
        return call('store', { key: 'd2s-settings', value: S.settings });
      })
      .then(render, fail);
  }

  function fail(err) {
    S.error = (err && err.message) || String(err);
    S.screen = S.d2s ? S.screen : 'connect';
    if (S.screen === 'loading') S.screen = 'connect';
    render();
  }

  // ---------- local drafts ----------

  /** Files that differ from what is on GitHub, as { path: text }. */
  function changedFiles() {
    var out = {};
    if (!S.d2s) return out;
    S.d2s.files().forEach(function (p) {
      var text = S.d2s.read(p);
      if (S.base.files[p] !== text) out[p] = text;
    });
    return out;
  }

  var draftTimer = null;
  function persistDrafts() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      var changes = changedFiles();
      var files = {};
      Object.keys(changes).forEach(function (p) {
        files[p] = { base: S.base.files[p] === undefined ? null : S.base.files[p], mine: changes[p] };
      });
      if (Object.keys(files).length) S.drafts[draftKey()] = { files: files };
      else delete S.drafts[draftKey()];
      call('store', { key: 'd2s-drafts', value: S.drafts }).catch(function () {});
    }, 400);
  }

  /** Put unsaved edits from last time back, unless GitHub moved on underneath them. */
  function applyDrafts() {
    S.draftConflicts = [];
    var draft = S.drafts[draftKey()];
    if (!draft) return;
    Object.keys(draft.files).forEach(function (p) {
      var d = draft.files[p];
      var remote = S.base.files[p] === undefined ? null : S.base.files[p];
      if (remote === d.mine) return;
      if (remote === d.base) S.d2s.write(p, d.mine);
      else S.draftConflicts.push({ path: p, mine: d.mine });
    });
  }

  // ---------- saving to GitHub ----------

  /** "002-saved-cards: Research updated by Dana via d2s plugin", from the files that changed. */
  function commitMessage(action, changes) {
    var user = S.user || t('someone');
    if (action && action.from) return t('commitNext', { id: S.expId, from: action.from, to: action.to, user: user });
    if (action && action.started) return t('commitNew', { id: S.expId, user: user });
    var ids = [];
    var stages = [];
    Object.keys(changes).forEach(function (p) {
      var m = /explorations\/([^/]+)\/([^/]+)$/.exec(p);
      if (!m) return;
      if (ids.indexOf(m[1]) < 0) ids.push(m[1]);
      var i = S.d2s.lib.STAGES.map(function (s) { return s.file; }).indexOf(m[2]);
      if (i >= 0 && stages.indexOf(t('stages')[i]) < 0) stages.push(t('stages')[i]);
    });
    return t('commitEdit', { id: ids.join(', ') || S.settings.repo, stage: stages.join(', ') || 'design', user: user });
  }

  function save(action) {
    var changes = changedFiles();
    if (!Object.keys(changes).length) {
      S.notice = { kind: 'info', text: t('nothingToSave') };
      return render();
    }
    S.saving = true;
    drawStatus();
    return S.client.save(S.settings.branch, S.base.head, changes, commitMessage(action, changes), S.overwrite)
      .then(function (r) {
        S.saving = false;
        if (r.conflicts.length) {
          S.conflicts = { paths: r.conflicts, theirs: r.theirs, action: action };
          return render();
        }
        S.base.head = r.commit;
        Object.keys(changes).forEach(function (p) { S.base.files[p] = changes[p]; });
        S.savedAt = Date.now();
        S.overwrite = [];
        S.conflicts = null;
        persistDrafts();
        render();
      })
      .catch(function (err) {
        S.saving = false;
        S.notice = { kind: 'gate', text: t('saveError', { error: err.message }) };
        persistDrafts();
        render();
      });
  }

  function resolveConflict(path, keepMine) {
    if (keepMine) S.overwrite.push(path);
    else {
      S.d2s.write(path, S.conflicts.theirs[path]);
      S.base.files[path] = S.conflicts.theirs[path];
    }
    S.conflicts.paths = S.conflicts.paths.filter(function (p) { return p !== path; });
    if (!S.conflicts.paths.length) {
      var action = S.conflicts.action;
      S.conflicts = null;
      return save(action);
    }
    render();
  }

  // ---------- the gate ----------

  function gaps(e) {
    var byKey = {};
    var list = [];
    S.d2s.lib.checkStageDoc(e.ctx, e.exp, e.stage).issues.forEach(function (issue) {
      if (issue.level !== 'error') return;
      var label = issue.section ? Form.labelOf(issue.section) : '';
      var text = issue.code === 'empty' ? t('empty', { label: label })
        : issue.code === 'missing' ? t('missingSection', { label: label })
        : issue.message;
      var key = issue.section ? Form.keyOf(issue.section) : null;
      if (key) (byKey[key] = byKey[key] || []).push(text);
      list.push({ key: key, text: text });
    });
    return { byKey: byKey, list: list };
  }

  function showGaps() {
    if (!S.gateShown) return; // a late check must not report on a stage that has already passed
    var e = exploration();
    if (!e) return;
    var g = gaps(e);
    if (S.form) S.form.setIssues(g.byKey);
    S.notice = g.list.length ? { kind: 'gate', text: t('gate'), items: g.list } : { kind: 'ok', text: t('gateClear') };
    drawNotice();
  }

  function next() {
    clearTimeout(refs.gateTimer);
    var before = exploration();
    var r = S.d2s.run(['next', before.exp.id]);
    if (r.code !== 0) {
      S.gateShown = true;
      showGaps();
      return;
    }
    var after = exploration();
    var names = t('stages');
    S.gateShown = false;
    S.view = null;
    S.notice = after.stage.id === 'handoff' ? { kind: 'ok', text: t('handoffReady') }
      : before.stage.id === 'decide' ? { kind: 'ok', text: t('decided', { stage: names[after.index] }) }
      : { kind: 'ok', text: t('moved', { stage: names[after.index] }) };
    S.finalDoc = 'summary';
    render();
    save({ from: before.stage.id, to: after.stage.id });
  }

  // ---------- frames ----------

  var FRAME_RE = /https?:\/\/(?:www\.)?figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)\/[^\s)\]>"']*?[?&]node-id=([^&\s)\]>"']+)/g;

  function fileKey() {
    if (S.fileKey) return S.fileKey;
    var m = /figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)/.exec(S.fileUrl || '');
    return m ? m[1] : '';
  }

  function frameLink(node) {
    var name = (S.fileName || 'File').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'File';
    return 'https://www.figma.com/design/' + fileKey() + '/' + name + '?node-id=' + encodeURIComponent(node.id.replace(/:/g, '-'));
  }

  /** Frames of this file linked in a field's text: [{ nodeId, label }]. */
  function framesIn(text) {
    var key = fileKey();
    var out = [];
    String(text || '').split('\n').forEach(function (line) {
      FRAME_RE.lastIndex = 0;
      var m;
      while ((m = FRAME_RE.exec(line))) {
        if (m[1] !== key) continue;
        var nodeId = decodeURIComponent(m[2]).replace(/-/g, ':');
        var label = line.slice(0, m.index).replace(/^[\s*+\-\d.)]+/, '').replace(/[\s:–—-]+$/, '');
        out.push({ nodeId: nodeId, label: label || nodeId });
      }
    });
    return out;
  }

  function decorate(field, slot) {
    slot.innerHTML = '';
    if (!fileKey()) return;
    framesIn(field.value).forEach(function (f) {
      slot.appendChild(h('button.chip', {
        type: 'button',
        title: t('showOnCanvas'),
        onclick: function () {
          call('show-node', { nodeId: f.nodeId }).then(function (ok) { if (!ok) notify(t('notFound'), true); });
        },
      }, '↗ ' + f.label));
    });
  }

  /** Fill the current stage's fields from a document written with an AI assistant. */
  function pasteFromClaude(pasted) {
    var e = exploration();
    var path = relPath(S.d2s.path.join(e.exp.dir, e.stage.file));
    var approvals = Form.keyOf(S.d2s.lib.KEY_SECTIONS[e.ctx.lang].approvedBy);
    var r = Form.applyDocument(S.d2s.read(path), S.d2s.lib.getTemplate(e.ctx, e.stage.template), pasted, { skip: [approvals] });
    if (!r.filled.length) {
      S.notice = { kind: 'gate', text: t('pasteNothing') };
      return drawNotice();
    }
    S.d2s.write(path, r.text);
    persistDrafts();
    S.pasteOpen = false;
    S.notice = {
      kind: 'ok',
      text: t('pasteFilled', { fields: r.filled.join(', ') }) +
        (r.skipped.length ? t('pasteSkipped', { fields: r.skipped.join(', ') }) : '') +
        (r.ignored.length ? t('pasteIgnored', { headings: r.ignored.join(', ') }) : ''),
    };
    render();
    if (S.gateShown) showGaps();
  }

  function drawPaste() {
    var slot = refs.paste;
    if (!slot) return;
    slot.innerHTML = '';
    if (!S.pasteOpen) {
      slot.appendChild(h('button.link', { type: 'button', onclick: function () { S.pasteOpen = true; drawPaste(); slot.querySelector('textarea').focus(); } }, t('pasteButton')));
      return;
    }
    var area = h('textarea', { rows: '8', dir: 'auto', 'aria-label': t('pasteTitle') });
    slot.appendChild(h('div.paste',
      h('strong', t('pasteTitle')),
      h('span.input-hint', t('pasteHint')),
      area,
      h('div.actions',
        h('button.primary', { type: 'button', onclick: function () { pasteFromClaude(area.value); } }, t('pasteApply')),
        h('button', { type: 'button', onclick: function () { S.pasteOpen = false; drawPaste(); } }, t('cancel'))
      )
    ));
  }

  function attachFrames() {
    var area = S.lastField;
    if (!area || !document.body.contains(area)) {
      notify(t('pickField'));
      return;
    }
    var lines = S.selection.map(function (n) { return '- ' + n.name + ': ' + frameLink(n); }).join('\n');
    var v = area.value;
    var start = typeof area.selectionStart === 'number' ? area.selectionStart : v.length;
    var end = typeof area.selectionEnd === 'number' ? area.selectionEnd : v.length;
    var before = v.slice(0, start);
    var after = v.slice(end);
    area.value = before + (before && !/\n$/.test(before) ? '\n' : '') + lines + (after && !/^\n/.test(after) ? '\n' : '') + after;
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.focus();
    var ref = S.settings.repo + '#' + S.expId;
    call('link', { ref: ref }).then(function (list) { S.linked = list || S.linked; }).catch(function () {});
  }

  // ---------- drawing ----------

  function render() {
    app.setAttribute('dir', S.lang === 'he' ? 'rtl' : 'ltr');
    document.documentElement.lang = S.lang;
    app.innerHTML = '';
    S.form = null;
    S.lastField = null;
    refs = {};
    if (S.screen === 'loading') app.appendChild(h('div.center', h('p.muted', t('loading'))));
    else if (S.screen === 'connect') app.appendChild(connectScreen());
    else if (S.screen === 'home') app.appendChild(homeScreen());
    else if (S.screen === 'new') app.appendChild(newScreen());
    else if (S.screen === 'exp') app.appendChild(explorationScreen());
  }

  function field(label, input, hint) {
    return h('label.input', h('span.input-label', label), input, hint ? h('span.input-hint', hint) : null);
  }

  function connectScreen() {
    var s = S.attempt || S.settings || {};
    var repo = h('input', { type: 'text', value: s.repo || '', placeholder: 'acme/checkout-app', autocomplete: 'off', spellcheck: 'false', dir: 'ltr' });
    var branch = h('input', { type: 'text', value: s.branch || '', placeholder: 'main', autocomplete: 'off', spellcheck: 'false', dir: 'ltr' });
    var token = h('input', { type: 'password', value: s.token || '', placeholder: 'github_pat_…', autocomplete: 'off', dir: 'ltr' });
    var api = h('input', { type: 'text', value: s.api || '', placeholder: 'https://api.github.com', autocomplete: 'off', dir: 'ltr' });
    return h('form.screen', {
      onsubmit: function (e) {
        e.preventDefault();
        connect({ repo: repo.value.trim(), branch: branch.value.trim(), token: token.value.trim(), api: api.value.trim() });
      },
    },
      h('h1', t('connectTitle')),
      h('p.muted', t('connectIntro')),
      S.error ? h('div.notice.gate', { role: 'alert' }, S.error) : null,
      field(t('repo'), repo, t('repoHint')),
      field(t('branch'), branch, t('branchHint')),
      field(t('token'), token, t('tokenHint')),
      h('button.link', {
        type: 'button',
        onclick: function () { call('open-url', { url: 'https://github.com/settings/personal-access-tokens/new' }); },
      }, t('createToken') + ' ↗'),
      h('details', { open: !!s.api }, h('summary', t('advanced')), field(t('api'), api, t('apiHint'))),
      h('div.actions', h('button.primary', { type: 'submit' }, t('connect')))
    );
  }

  function header(left) {
    return h('div.top',
      left,
      h('span.repo', { dir: 'ltr', title: S.settings.repo + ' · ' + S.settings.branch }, S.settings.repo.split('/')[1] + ' · ' + S.settings.branch)
    );
  }

  function homeScreen() {
    var c = ctx();
    var lib = S.d2s.lib;
    var names = t('stages');
    var list = lib.listExplorations(c).map(function (e) {
      return { exp: e, linked: S.linked.indexOf(S.settings.repo + '#' + e.id) >= 0, index: lib.stageIndex(e.stage) };
    });
    list.sort(function (a, b) { return (b.linked - a.linked) || (a.exp.id < b.exp.id ? 1 : -1); });
    return h('div.screen',
      header(h('h1', t('explorations'))),
      draftConflictsBox(),
      S.notice ? h('div.notice.' + S.notice.kind, S.notice.text) : null,
      list.length
        ? h('ul.list', list.map(function (item) {
          var e = item.exp;
          return h('li', h('button.row', {
            type: 'button',
            onclick: function () {
              S.expId = e.id;
              S.view = null;
              S.pasteOpen = false;
              S.notice = null;
              S.gateShown = false;
              S.screen = 'exp';
              render();
            },
          },
            h('span.row-title', e.title),
            h('span.row-meta',
              h('bdi', { dir: 'ltr' }, e.id),
              ' · ' + (item.index >= 0 ? t('stageOf', { n: item.index + 1 }) + ' · ' + names[item.index] : e.stage),
              e.owner ? ' · ' + e.owner : ''
            ),
            item.linked ? h('span.badge', t('inThisFile')) : null
          ));
        }))
        : h('p.muted.empty', t('none')),
      h('div.actions',
        h('button.primary', { type: 'button', onclick: function () { S.screen = 'new'; S.notice = null; render(); } }, t('newExploration')),
        h('button', { type: 'button', onclick: function () { S.notice = null; connect(S.settings); } }, t('refresh')),
        h('button.link', {
          type: 'button',
          onclick: function () {
            S.settings = { repo: S.settings.repo, branch: S.settings.branch, api: S.settings.api };
            S.d2s = null;
            S.screen = 'connect';
            call('store', { key: 'd2s-settings', value: S.settings }).then(render, render);
          },
        }, t('disconnect'))
      )
    );
  }

  function draftConflictsBox() {
    if (!S.draftConflicts.length) return null;
    return h('div.notice.gate', S.draftConflicts.map(function (c) {
      return h('div.conflict',
        h('p', t('draftConflict', { file: c.path })),
        h('div.actions',
          h('button', { type: 'button', onclick: function () { S.d2s.write(c.path, c.mine); dropDraftConflict(c); } }, t('keepMine')),
          h('button', { type: 'button', onclick: function () { dropDraftConflict(c); } }, t('takeTheirs'))
        )
      );
    }));
  }

  function dropDraftConflict(c) {
    S.draftConflicts = S.draftConflicts.filter(function (x) { return x !== c; });
    persistDrafts();
    render();
  }

  function newScreen() {
    var lib = S.d2s.lib;
    var title = h('input', { type: 'text', autocomplete: 'off' });
    var owner = h('input', { type: 'text', value: S.user || '', autocomplete: 'off' });
    var slug = h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', dir: 'ltr' });
    var slugField = field(t('slug'), slug, t('slugHint'));
    slugField.hidden = true;
    title.addEventListener('input', function () { slugField.hidden = !!lib.slugify(title.value) || !title.value.trim(); });
    var form = h('form.screen', {
      onsubmit: function (e) {
        e.preventDefault();
        var name = title.value.trim();
        if (!name) return title.focus();
        if (!lib.slugify(name) && !lib.slugify(slug.value)) return slug.focus();
        var args = ['new', name, '--owner', owner.value.trim()];
        if (slug.value.trim()) args.push('--slug', slug.value.trim());
        var r = S.d2s.run(args);
        if (r.code !== 0) {
          S.notice = { kind: 'gate', text: r.lines.join(' ') };
          return render();
        }
        var all = lib.listExplorations(ctx());
        S.expId = all[all.length - 1].id;
        S.view = null;
        S.notice = null;
        S.screen = 'exp';
        render();
        call('link', { ref: S.settings.repo + '#' + S.expId }).then(function (list) { S.linked = list || S.linked; }).catch(function () {});
        save({ started: true });
      },
    },
      header(h('h1', t('newExploration'))),
      S.notice ? h('div.notice.' + S.notice.kind, S.notice.text) : null,
      field(t('title'), title, t('titleHint')),
      field(t('owner'), owner),
      slugField,
      h('div.actions',
        h('button.primary', { type: 'submit' }, t('start')),
        h('button', { type: 'button', onclick: function () { S.screen = 'home'; S.notice = null; render(); } }, t('cancel'))
      )
    );
    setTimeout(function () { title.focus(); }, 0);
    return form;
  }

  var refs = {};

  function explorationScreen() {
    var e = exploration();
    if (!e) {
      S.screen = 'home';
      return homeScreen();
    }
    var lib = S.d2s.lib;
    var names = t('stages');
    var shown = S.view === null ? e.index : S.view;
    var stage = lib.STAGES[shown];
    var current = shown === e.index;
    var handoff = stage.id === 'handoff';
    var path = relPath(S.d2s.path.join(e.exp.dir, stage.file));
    if (handoff && S.finalDoc === 'summary' && S.d2s.exists(path.replace(/handoff\.md$/, 'summary.md'))) {
      path = path.replace(/handoff\.md$/, 'summary.md');
    }

    var rail = h('ol.stepper', lib.STAGES.map(function (s, i) {
      return h('li', h('button', {
        type: 'button',
        class: (i < e.index ? 'done' : i === e.index ? 'current' : 'todo') + (i === shown ? ' shown' : ''),
        disabled: i > e.index,
        'aria-current': i === e.index ? 'step' : null,
        title: names[i],
        onclick: function () {
          S.view = i === e.index ? null : i;
          S.notice = null;
          render();
        },
      }, h('span.mark', i < e.index ? '✓' : String(i + 1)), h('span.stage-name', names[i])));
    }));

    var body;
    var intro;
    if (handoff) {
      intro = t(S.finalDoc === 'summary' ? 'summaryIntro' : 'handoffIntro');
      var handoffPath = relPath(S.d2s.path.join(e.exp.dir, 'handoff.md'));
      body = h('div',
        h('div.toggle', ['summary', 'handoff'].map(function (doc) {
          return h('button', {
            type: 'button',
            'aria-pressed': String(S.finalDoc === doc),
            onclick: function () { S.finalDoc = doc; render(); },
          }, t(doc === 'summary' ? 'docSummary' : 'docHandoff'));
        })),
        h('div.md'),
        h('div.actions', h('button', { type: 'button', onclick: function () { copyLink(handoffPath); } }, t('copyLink')))
      );
      body.querySelector('.md').innerHTML = Form.markdown(S.d2s.read(path));
    } else {
      var m = Form.model(S.d2s.read(path), lib.getTemplate(e.ctx, stage.template));
      intro = current ? m.intro : t('done', { file: stage.file });
      body = h('div.form');
      body.addEventListener('focusin', function (ev) {
        if (ev.target.tagName === 'TEXTAREA' && !ev.target.readOnly) {
          S.lastField = ev.target;
          drawAttach();
        }
      });
      S.form = Form.render(body, m, {
        readOnly: !current,
        dir: S.lang === 'he' ? 'rtl' : 'ltr',
        text: { optional: t('optional') },
        decorate: decorate,
        approvals: stage.id === 'decide' && {
          key: Form.keyOf(lib.KEY_SECTIONS[e.ctx.lang].approvedBy),
          roles: e.ctx.config.approvals.roles.map(function (r) { return lib.roleLabel(lib.roleKey(r), e.ctx.lang); }),
          today: lib.today(),
          parse: lib.parseApprovalLines,
          format: lib.formatApprovalLine,
          example: null,
          text: { name: t('name'), role: t('role'), add: t('addPerson'), remove: t('remove'), note: t('approvalNote') },
        },
        onInput: function (f, value) {
          S.d2s.write(path, Form.setField(S.d2s.read(path), f.key, value, f.heading));
          persistDrafts();
          drawStatus();
          if (S.gateShown) {
            clearTimeout(refs.gateTimer);
            refs.gateTimer = setTimeout(showGaps, 250);
          }
        },
      });
      if (S.gateShown && current) S.form.setIssues(gaps(e).byKey);
    }

    refs.notice = h('div.notice-slot', { tabindex: '-1' });
    refs.attach = h('div.attach-slot');
    refs.paste = h('div.paste-slot');
    refs.status = h('span.status', { 'aria-live': 'polite' });
    var screen = h('div.screen.exp',
      header(h('button.back', { type: 'button', onclick: function () { S.screen = 'home'; S.notice = null; render(); } }, (S.lang === 'he' ? '→ ' : '← ') + t('back'))),
      h('h1', e.exp.title),
      h('p.meta', h('bdi', { dir: 'ltr' }, e.exp.id), e.exp.owner ? ' · ' + t('owner') + ': ' + e.exp.owner : ''),
      rail,
      h('p.step', t('stageOf', { n: shown + 1 }) + ' · ' + names[shown]),
      h('p.muted.intro', intro),
      conflictsBox(),
      refs.notice,
      current && !handoff ? refs.attach : null,
      current && !handoff ? refs.paste : null,
      body,
      h('div.footer',
        refs.status,
        h('button', { type: 'button', onclick: function () { save(); } }, t('save')),
        current && !handoff ? h('button.primary', { type: 'button', onclick: next }, t('next')) : null
      )
    );
    drawNotice();
    drawAttach();
    drawPaste();
    drawStatus();
    return screen;
  }

  function conflictsBox() {
    if (!S.conflicts) return null;
    return h('div.notice.gate',
      h('p', t('conflictTitle')),
      S.conflicts.paths.map(function (p) {
        return h('div.conflict',
          h('code', { dir: 'ltr' }, p),
          h('div.actions',
            h('button', { type: 'button', onclick: function () { resolveConflict(p, true); } }, t('keepMine')),
            h('button', { type: 'button', onclick: function () { resolveConflict(p, false); } }, t('takeTheirs'))
          )
        );
      })
    );
  }

  function drawNotice() {
    var slot = refs.notice;
    if (!slot) return;
    slot.innerHTML = '';
    var n = S.notice;
    if (!n) return;
    slot.appendChild(h('div.notice.' + n.kind, { role: n.kind === 'gate' ? 'alert' : 'status' },
      h('p', n.text),
      n.items && n.items.length ? h('ul', n.items.map(function (item) {
        return h('li', item.key && S.form
          ? h('button.link', { type: 'button', onclick: function () { S.form.focus(item.key); } }, item.text)
          : item.text);
      })) : null
    ));
  }

  function drawAttach() {
    var slot = refs.attach;
    if (!slot) return;
    slot.innerHTML = '';
    if (!fileKey()) {
      var url = h('input', { type: 'text', placeholder: 'https://www.figma.com/design/…', dir: 'ltr' });
      slot.appendChild(h('form.file-link', {
        onsubmit: function (ev) {
          ev.preventDefault();
          if (!/figma\.com\/(?:design|file|proto)\/[A-Za-z0-9]+/.test(url.value)) return notify(t('badFileLink'), true);
          S.fileUrl = url.value.trim();
          call('set-file-url', { url: S.fileUrl }).catch(function () {});
          render();
        },
      }, h('strong', t('fileLinkTitle')), h('span.input-hint', t('fileLinkHint')), h('div.inline', url, h('button', { type: 'submit' }, t('fileLinkSave')))));
      return;
    }
    var n = S.selection.length;
    slot.appendChild(h('div.attach',
      h('button', { type: 'button', disabled: !n, onclick: attachFrames }, n ? t('attachN', { n: n }) : t('attach')),
      h('span.input-hint', t('attachHint'))
    ));
  }

  function minutesAgo(ts) {
    var m = Math.floor((Date.now() - ts) / 60000);
    return m < 1 ? t('justNow') : t('minutesAgo', { n: m });
  }

  function drawStatus() {
    var slot = refs.status;
    if (!slot) return;
    var dirty = Object.keys(changedFiles()).length > 0;
    slot.textContent = S.saving ? t('saving') : dirty ? t('unsaved') : S.savedAt ? t('saved', { when: minutesAgo(S.savedAt) }) : t('upToDate');
    slot.className = 'status' + (dirty && !S.saving ? ' dirty' : '');
  }
  setInterval(drawStatus, 30000);

  function copyLink(path) {
    var url = 'https://github.com/' + S.settings.repo + '/blob/' + S.settings.branch.split('/').map(encodeURIComponent).join('/') + '/' + path;
    var area = h('textarea', { style: 'position:fixed;opacity:0' });
    area.value = url;
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(area);
    if (!ok && navigator.clipboard) navigator.clipboard.writeText(url).catch(function () {});
    notify(t('copied'));
  }

  // ---------- start ----------

  call('init').then(function (info) {
    S.user = info.user || '';
    S.fileKey = info.fileKey || '';
    S.fileName = info.fileName || '';
    S.fileUrl = info.fileUrl || '';
    S.linked = info.linked || [];
    S.selection = info.selection || [];
    S.drafts = info.drafts || {};
    S.settings = info.settings;
    if (S.settings && S.settings.token && S.settings.repo) connect(S.settings);
    else {
      S.screen = 'connect';
      render();
    }
  }, function (err) {
    S.error = err.message;
    S.screen = 'connect';
    render();
  });
})();
