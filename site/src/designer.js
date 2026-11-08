/*
 * The sandbox's Designer view: forms and a "Next stage" button instead of a terminal.
 * It runs its own copy of the real d2s (see runtime.js) on a sample exploration,
 * so the gate, the decision log and the handoff behave exactly like the CLI.
 */
(function () {
  'use strict';

  var Form = window.D2SForm;
  var I18N = window.D2S_I18N;
  var SAMPLES = window.D2S_SAMPLES || { en: {}, he: {} };
  var rootEl = document.getElementById('dz');
  if (!rootEl || !Form || typeof window.D2S_NEW !== 'function') return;

  var D2S = window.D2S_NEW();
  var lib = D2S.lib;
  var lang = null;
  var view = null; // the stage index being shown; null = the current stage
  var gateShown = false; // after a blocked "Next stage", gaps update as you type
  var notice = null;
  var showFile = false;
  var finalDoc = 'summary'; // at the last stage: summary.md (design and product) or handoff.md (developers)
  var form = null;
  var revalidate = null;

  var $ = function (sel) { return rootEl.querySelector(sel); };
  var els = {
    title: $('.dz-title'),
    meta: $('.dz-meta'),
    rail: $('.dz-rail ol'),
    step: $('.dz-step'),
    intro: $('.dz-intro'),
    notice: $('.dz-notice'),
    form: $('.dz-form'),
    preview: $('.dz-preview'),
    docs: $('.dz-docs'),
    actions: $('.dz-actions'),
    next: $('.dz-next'),
    example: $('.dz-example'),
    toggle: $('.dz-toggle'),
    reset: $('.dz-reset'),
    file: $('.dz-file'),
    filePath: $('.dz-file-path'),
    fileText: $('.dz-file-text'),
    main: $('.dz-main'),
  };

  function t(key, vars) {
    var table = (I18N[lang] && I18N[lang].ui) || {};
    var s = table[key] !== undefined ? table[key] : I18N.en.ui[key];
    if (typeof s !== 'string') return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? vars[k] : m; });
  }

  // ---------- project state ----------

  function state() {
    var ctx = lib.loadContext(D2S.cwd);
    var exp = lib.listExplorations(ctx)[0];
    var index = lib.stageIndex(exp.stage);
    return { ctx: ctx, exp: exp, index: index, stage: lib.STAGES[index] };
  }

  function docPath(s, stage) {
    return D2S.path.relative(D2S.cwd, D2S.path.join(s.exp.dir, stage.file));
  }

  function approvalKey() {
    return Form.keyOf(lib.KEY_SECTIONS[lang].approvedBy);
  }

  function roleLabels(s) {
    return s.ctx.config.approvals.roles.map(function (r) { return lib.roleLabel(lib.roleKey(r), lang); });
  }

  function sampleApprovers() {
    var text = ((SAMPLES[lang] || {})['decision.md'] || {})[lib.KEY_SECTIONS[lang].approvedBy] || '';
    return lib.parseApprovalLines(text).filter(function (p) { return p.ok; });
  }

  /** Start mid-story: an exploration exists and its brief is half written. */
  function start() {
    D2S.reset();
    D2S.run(['init', '--lang', lang, '--cli', 'd2s', '--agents', 'none']);
    D2S.run(['new', t('dzSampleTitle'), '--slug', 'checkout', '--owner', t('dzSampleOwner')]);
    var s = state();
    var path = docPath(s, s.stage);
    var text = D2S.read(path);
    var samples = (SAMPLES[lang] || {})['brief.md'] || {};
    Form.model(text, lib.getTemplate(s.ctx, s.stage.template)).fields.slice(0, 2).forEach(function (f) {
      if (samples[f.label]) text = Form.setField(text, f.key, samples[f.label], f.heading);
    });
    D2S.write(path, text);
    view = null;
    gateShown = false;
    notice = null;
    finalDoc = 'summary';
    render();
  }

  // ---------- gate ----------

  /** The current stage's gaps, in plain words, grouped by field. */
  function gaps(s) {
    var byKey = {};
    var general = [];
    var list = [];
    lib.checkStageDoc(s.ctx, s.exp, s.stage).issues.forEach(function (issue) {
      if (issue.level !== 'error') return;
      var label = issue.section ? Form.labelOf(issue.section) : '';
      var text = issue.code === 'empty' ? t('dzEmpty', { label: label })
        : issue.code === 'missing' ? t('dzMissingSection', { label: label })
        : issue.message;
      if (issue.section) {
        var key = Form.keyOf(issue.section);
        (byKey[key] = byKey[key] || []).push(text);
        list.push({ key: key, text: text });
      } else {
        general.push(text);
        list.push({ key: null, text: text });
      }
    });
    return { byKey: byKey, general: general, list: list };
  }

  function showGaps() {
    if (!gateShown) return; // a late check must not report on a stage that has already passed
    var s = state();
    var g = gaps(s);
    if (form) form.setIssues(g.byKey);
    notice = g.list.length ? { kind: 'gate', text: t('dzGate'), items: g.list } : { kind: 'ok', text: t('dzGateClear') };
    drawNotice();
  }

  function next() {
    clearTimeout(revalidate);
    var before = state();
    var r = D2S.run(['next', before.exp.id]);
    if (r.code !== 0) {
      gateShown = true;
      showGaps();
      if (notice.kind !== 'gate') {
        // Blocked by something outside this stage's fields: show what d2s printed.
        var raw = r.lines.filter(function (l) { return /^\s+\S/.test(l); });
        notice = { kind: 'gate', text: t('dzGate'), items: raw.map(function (l) { return { key: null, text: l.trim() }; }) };
        drawNotice();
      }
      els.notice.focus();
      return;
    }
    var s = state();
    var name = t('dzStages')[s.index];
    gateShown = false;
    view = null;
    if (s.stage.id === 'handoff') notice = { kind: 'ok', text: t('dzHandoffReady') + ' ' + t('dzRestartHint') };
    else if (before.stage.id === 'decide') notice = { kind: 'ok', text: t('dzDecided', { stage: name }) };
    else notice = { kind: 'ok', text: t('dzMoved', { stage: name, file: s.stage.file }) };
    render();
    if (els.main.scrollIntoView && els.main.getBoundingClientRect().top < 0) els.main.scrollIntoView({ block: 'start' });
    els.notice.focus();
  }

  function useExample() {
    var s = state();
    var path = docPath(s, s.stage);
    var text = D2S.read(path);
    var samples = (SAMPLES[lang] || {})[s.stage.file] || {};
    var filled = 0;
    Form.model(text, lib.getTemplate(s.ctx, s.stage.template)).fields.forEach(function (f) {
      if (f.value.trim() || f.optional || f.key === approvalKey()) return;
      text = Form.setField(text, f.key, samples[f.label] || t('dzExampleFallback'), f.heading);
      filled++;
    });
    D2S.write(path, text);
    notice = { kind: 'info', text: filled ? t('dzFilled', { n: filled }) : t('dzNothingToFill') };
    render();
    if (gateShown) showGaps();
  }

  // ---------- drawing ----------

  function drawRail(s) {
    els.rail.innerHTML = '';
    var names = t('dzStages');
    var shown = view === null ? s.index : view;
    lib.STAGES.forEach(function (stage, i) {
      var li = document.createElement('li');
      li.className = i < s.index ? 'done' : i === s.index ? 'current' : 'todo';
      var b = document.createElement('button');
      b.type = 'button';
      b.disabled = i > s.index;
      if (i === s.index) b.setAttribute('aria-current', 'step');
      if (i === shown) b.classList.add('shown');
      var mark = document.createElement('span');
      mark.className = 'dz-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = i < s.index ? '✓' : String(i + 1);
      var label = document.createElement('span');
      label.className = 'dz-stage';
      label.textContent = names[i];
      var file = document.createElement('span');
      file.className = 'dz-stage-file';
      file.dir = 'ltr';
      file.textContent = stage.file;
      b.appendChild(mark);
      b.appendChild(label);
      b.appendChild(file);
      b.addEventListener('click', function () {
        view = i === s.index ? null : i;
        if (view !== null) notice = null;
        render();
      });
      li.appendChild(b);
      els.rail.appendChild(li);
    });
  }

  function drawNotice() {
    var n = notice;
    els.notice.innerHTML = '';
    els.notice.hidden = !n;
    if (!n) return;
    els.notice.className = 'dz-notice ' + n.kind;
    var p = document.createElement('p');
    p.textContent = n.text;
    els.notice.appendChild(p);
    if (n.items && n.items.length) {
      var ul = document.createElement('ul');
      n.items.forEach(function (item) {
        var li = document.createElement('li');
        if (item.key && form) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'link-btn';
          b.textContent = item.text;
          b.addEventListener('click', function () { form.focus(item.key); });
          li.appendChild(b);
        } else li.textContent = item.text;
        ul.appendChild(li);
      });
      els.notice.appendChild(ul);
    }
  }

  function drawFile(path) {
    els.file.hidden = !showFile;
    els.toggle.setAttribute('aria-pressed', String(showFile));
    rootEl.classList.toggle('with-file', showFile);
    if (!showFile) return;
    els.filePath.textContent = path;
    els.fileText.dir = lang === 'he' ? 'rtl' : 'ltr';
    els.fileText.textContent = D2S.read(path);
  }

  function render() {
    var s = state();
    var shownIndex = view === null ? s.index : view;
    var stage = lib.STAGES[shownIndex];
    var path = docPath(s, stage);
    var handoff = stage.id === 'handoff';
    if (handoff && finalDoc === 'summary' && D2S.exists(path.replace(/handoff\.md$/, 'summary.md'))) {
      path = path.replace(/handoff\.md$/, 'summary.md');
    }
    var current = shownIndex === s.index;

    els.title.textContent = s.exp.title;
    els.meta.textContent = '';
    var id = document.createElement('bdi');
    id.dir = 'ltr';
    id.textContent = s.exp.id;
    els.meta.appendChild(id);
    els.meta.appendChild(document.createTextNode(' · ' + t('dzOwner') + ': ' + s.exp.owner));
    drawRail(s);
    els.step.textContent = t('dzStageOf', { n: shownIndex + 1 }) + ' · ' + t('dzStages')[shownIndex];

    els.form.hidden = handoff;
    els.preview.hidden = !handoff;
    els.docs.hidden = !handoff;
    Array.prototype.forEach.call(els.docs.querySelectorAll('[data-doc]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-doc') === finalDoc));
    });
    els.actions.hidden = !current || handoff;
    form = null;

    if (handoff) {
      els.intro.textContent = t(finalDoc === 'summary' ? 'dzSummaryIntro' : 'dzHandoffIntro');
      els.preview.innerHTML = Form.markdown(D2S.read(path));
      if (!notice) notice = { kind: 'info', text: t('dzRestartHint') };
    } else {
      var m = Form.model(D2S.read(path), lib.getTemplate(s.ctx, stage.template));
      els.intro.textContent = current ? m.intro : t('dzDone', { file: stage.file });
      form = Form.render(els.form, m, {
        readOnly: !current,
        dir: lang === 'he' ? 'rtl' : 'ltr',
        text: { optional: t('dzOptional') },
        approvals: stage.id === 'decide' && {
          key: approvalKey(),
          roles: roleLabels(s),
          today: lib.today(),
          parse: lib.parseApprovalLines,
          format: lib.formatApprovalLine,
          example: sampleApprovers().length ? sampleApprovers : null,
          text: {
            name: t('dzName'),
            role: t('dzRole'),
            add: t('dzAddPerson'),
            remove: t('dzRemove'),
            example: t('dzExampleApprovers'),
            note: t('dzApprovalNote'),
          },
        },
        onInput: function (field, value) {
          D2S.write(path, Form.setField(D2S.read(path), field.key, value, field.heading));
          drawFile(path);
          if (gateShown) {
            clearTimeout(revalidate);
            revalidate = setTimeout(showGaps, 250);
          }
        },
      });
      if (gateShown && current) form.setIssues(gaps(s).byKey);
    }
    drawNotice();
    drawFile(path);
  }

  // ---------- wiring ----------

  els.next.addEventListener('click', next);
  Array.prototype.forEach.call(els.docs.querySelectorAll('[data-doc]'), function (b) {
    b.addEventListener('click', function () {
      finalDoc = b.getAttribute('data-doc');
      render();
    });
  });
  els.example.addEventListener('click', useExample);
  els.reset.addEventListener('click', start);
  els.toggle.addEventListener('click', function () {
    showFile = !showFile;
    var s = state();
    drawFile(docPath(s, lib.STAGES[view === null ? s.index : view]));
    if (form) form.resize();
  });
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (form) form.resize(); }, 150);
  });
  // The panel starts hidden when another tab is open; fit the fields once it shows.
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(function () { if (form) form.resize(); }).observe(els.form);
  }

  function setLang(next) {
    next = next === 'he' ? 'he' : 'en';
    if (next === lang) return;
    lang = next;
    start();
  }

  document.addEventListener('d2s:lang', function (e) { setLang(e.detail); });
  window.D2S_DESIGNER = { setLang: setLang, sandbox: D2S };
})();
