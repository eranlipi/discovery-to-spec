/*
 * The stage form: one labelled field per "## " section of a d2s template.
 * The heading is the label, the template's <!-- --> note is the helper text,
 * and "(optional)" becomes a badge. The Markdown file stays the source of truth:
 * the form reads it and writes it back.
 *
 * Shared by the website's Designer view and meant for the Figma plugin, whose UI
 * is a web page too. Model functions are pure; render() needs a DOM.
 */
(function (root) {
  'use strict';

  var OPTIONAL_RE = /\((optional|אופציונלי)\)/i;
  var COMMENT_RE = /<!--([\s\S]*?)-->/g;
  var uid = 0;

  // ---------- model ----------

  /** Split Markdown into the text before the first "## " and its sections. Ignores code fences. */
  function splitDoc(text) {
    var head = [];
    var sections = [];
    var current = null;
    var fence = false;
    String(text).replace(/\r\n/g, '\n').split('\n').forEach(function (line) {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      var m = fence ? null : /^##\s+(.+?)\s*$/.exec(line);
      if (m) {
        current = { line: line, heading: m[1], body: [] };
        sections.push(current);
      } else if (current) current.body.push(line);
      else head.push(line);
    });
    return { head: head, sections: sections };
  }

  function joinDoc(doc) {
    var out = doc.head.slice();
    doc.sections.forEach(function (s) {
      out.push(s.line);
      out.push.apply(out, s.body);
    });
    return out.join('\n').replace(/\n*$/, '\n');
  }

  function labelOf(heading) {
    return heading.replace(OPTIONAL_RE, '').replace(/\s+/g, ' ').trim();
  }

  /** How fields are matched: case, "(optional)" and the kind of apostrophe or quote mark don't matter. */
  function keyOf(heading) {
    return labelOf(heading).toLowerCase().replace(/[\u05F3\u2019\u2018`']/g, "'").replace(/[\u05F4\u201C\u201D]/g, '"');
  }

  function stripComments(text) {
    return text.replace(COMMENT_RE, '');
  }

  function notesOf(body) {
    var notes = [];
    body.replace(COMMENT_RE, function (_m, c) {
      notes.push(c.replace(/\s+/g, ' ').trim());
      return '';
    });
    return notes.join(' ');
  }

  function introOf(text) {
    var body = String(text).replace(/^---\n[\s\S]*?\n---\n/, '');
    var m = /^>\s?(.+)$/m.exec(body.split(/^##\s/m)[0]);
    return m ? m[1].trim() : '';
  }

  /**
   * The form for a document: its fields follow the template's sections, in order.
   * Each field: { key, label, heading, optional, helper, value }.
   */
  function model(docText, templateText) {
    var doc = splitDoc(docText);
    var byKey = {};
    doc.sections.forEach(function (s) { byKey[keyOf(s.heading)] = s; });
    var fields = splitDoc(templateText).sections.map(function (t) {
      var s = byKey[keyOf(t.heading)];
      return {
        key: keyOf(t.heading),
        label: labelOf(t.heading),
        heading: s ? s.heading : t.heading,
        optional: OPTIONAL_RE.test(t.heading),
        helper: notesOf(t.body.join('\n')),
        value: s ? stripComments(s.body.join('\n')).trim() : '',
      };
    });
    return { intro: introOf(docText) || introOf(templateText), fields: fields };
  }

  /**
   * Write one field back into the document. The section's guidance note stays;
   * "## " lines typed into a field become "### " so they can't start a new section.
   */
  function setField(docText, key, value, heading) {
    var doc = splitDoc(docText);
    var section = doc.sections.filter(function (s) { return keyOf(s.heading) === key; })[0];
    if (!section) {
      section = { line: '## ' + (heading || key), heading: heading || key, body: [] };
      if (doc.sections.length || doc.head.join('').trim()) doc.sections.push(section);
      else doc.sections = [section];
    }
    var clean = String(value || '').replace(/\r\n/g, '\n').replace(/^(\s*)##(?=\s|$)/gm, '$1###').trim();
    var notes = (/^\s*((?:<!--[\s\S]*?-->\s*)*)/.exec(section.body.join('\n')) || ['', ''])[1].trim();
    var parts = [];
    if (notes) parts.push(notes);
    if (clean) parts.push(clean);
    section.body = (parts.join('\n') + '\n').split('\n');
    return joinDoc(doc);
  }

  /**
   * Fill fields from a pasted document, such as one written with an AI assistant: every
   * "## " section whose heading matches a field replaces that field's text.
   * Fields whose keys are in opts.skip are left alone and listed in `skipped`.
   * Returns { text, filled: [labels], ignored: [headings that match no field], skipped: [labels] }.
   */
  function applyDocument(docText, templateText, pasted, opts) {
    var skip = (opts && opts.skip) || [];
    var skipped = [];
    var src = String(pasted || '').replace(/\r\n/g, '\n').trim();
    // A whole chat reply may be pasted: use the code block that holds the document, if there is one,
    // and drop the "paste it in d2s" line that the assistant adds.
    var fence = /(^|\n)(```|~~~)[^\n]*\n([\s\S]*?)\n\2[ \t]*(?=\n|$)/.exec(src);
    if (fence && /^##\s/m.test(fence[3])) src = fence[3];
    src = src.split('\n').filter(function (line) { return !/Paste from (?:AI|Claude)|הדבקה מ-(?:AI|Claude)/.test(line); }).join('\n');
    var fields = {};
    model(docText, templateText).fields.forEach(function (f) { fields[f.key] = f; });
    var text = docText;
    var filled = [];
    var ignored = [];
    splitDoc(src).sections.forEach(function (s) {
      var field = fields[keyOf(s.heading)];
      var value = stripComments(s.body.join('\n')).trim();
      if (!field) ignored.push(labelOf(s.heading));
      else if (skip.indexOf(field.key) >= 0) {
        if (value && skipped.indexOf(field.label) < 0) skipped.push(field.label);
      } else if (value) {
        text = setField(text, field.key, value, field.heading);
        if (filled.indexOf(field.label) < 0) filled.push(field.label);
      }
    });
    return { text: text, filled: filled, ignored: ignored, skipped: skipped };
  }

  // ---------- a small Markdown renderer, for previews ----------

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** A Figma frame link reads as "Figma · 10-1 ↗"; other links stay as they are. */
  function shortLink(url) {
    var m = /figma\.com\/[^?#]*\?(?:[^#]*?&(?:amp;)?)?node-id=([^&#]+)/.exec(url);
    return m ? 'Figma · ' + decodeURIComponent(m[1]) + ' \u2197' : url;
  }

  function inline(text) {
    var codes = [];
    var s = escapeHtml(text).replace(/`([^`]+)`/g, function (_m, c) {
      codes.push('<code>' + c + '</code>');
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    s = s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, label, href) {
        return /^https?:\/\//.test(href)
          ? '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'
          : '<span class="md-ref" title="' + href + '">' + label + '</span>';
      })
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_m, pre, url) {
        return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer" title="' + url + '">' + shortLink(url) + '</a>';
      });
    return s.replace(/\u0000(\d+)\u0000/g, function (_m, i) { return codes[i]; });
  }

  /** Markdown to HTML for headings, paragraphs, lists, quotes, tables and code. Input is escaped. */
  function markdown(text) {
    var lines = stripComments(String(text).replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '')).split('\n');
    var html = [];
    var para = [];
    var list = null;
    function flush() {
      if (para.length) html.push('<p>' + inline(para.join(' ')) + '</p>');
      para = [];
      if (list) html.push('</' + list + '>');
      list = null;
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m;
      if (/^\s*(```|~~~)/.test(line)) {
        flush();
        var code = [];
        for (i++; i < lines.length && !/^\s*(```|~~~)/.test(lines[i]); i++) code.push(lines[i]);
        html.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
      } else if (!line.trim()) flush();
      else if ((m = /^(#{1,4})\s+(.+)$/.exec(line))) {
        flush();
        var level = Math.min(m[1].length + 1, 5);
        html.push('<h' + level + '>' + inline(m[2]) + '</h' + level + '>');
      } else if ((m = /^>\s?(.*)$/.exec(line))) {
        flush();
        html.push('<blockquote>' + inline(m[1]) + '</blockquote>');
      } else if (/^\s*\|/.test(line) && lines[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        flush();
        var cells = function (row) {
          return row.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return inline(c.trim()); });
        };
        var rows = ['<tr>' + cells(line).map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr>'];
        for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
          rows.push('<tr>' + cells(lines[i]).map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>');
        }
        i--;
        html.push('<div class="md-table"><table>' + rows.join('') + '</table></div>');
      } else if ((m = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line))) {
        var kind = m[1] ? 'ul' : 'ol';
        if (para.length) {
          html.push('<p>' + inline(para.join(' ')) + '</p>');
          para = [];
        }
        if (list !== kind) {
          if (list) html.push('</' + list + '>');
          html.push('<' + kind + '>');
          list = kind;
        }
        html.push('<li>' + inline(m[3]) + '</li>');
      } else if (list && /^\s{2,}\S/.test(line)) {
        html[html.length - 1] = html[html.length - 1].replace(/<\/li>$/, ' ' + inline(line.trim()) + '</li>');
      } else {
        if (list) {
          html.push('</' + list + '>');
          list = null;
        }
        para.push(line.trim());
      }
    }
    flush();
    return html.join('\n');
  }

  // ---------- DOM ----------

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function grow(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(textarea.scrollHeight + 2, 64) + 'px';
  }

  /**
   * "Approved by" as rows of name and role. Returns null when the text is free
   * form that the rows can't hold, so the caller falls back to a text field.
   */
  function approvalRows(field, opts, emit) {
    var A = opts.approvals;
    var parsed = A.parse(field.value);
    if (parsed.some(function (p) { return !p.ok; })) return null;
    var rows = parsed.length
      ? parsed.map(function (p) { return { name: p.name, role: p.role, date: p.date, handle: p.handle }; })
      : A.roles.map(function (role) { return { name: '', role: role, date: '', handle: '' }; });
    var box = el('div', 'approvals');
    var list = el('div', 'approval-rows');
    box.appendChild(list);

    function write() {
      emit(rows
        .filter(function (r) { return r.name.trim(); })
        .map(function (r) { return A.format({ name: r.name.trim(), role: r.role, date: r.date || A.today, handle: r.handle }); })
        .join('\n'));
    }

    function draw() {
      list.innerHTML = '';
      rows.forEach(function (row, i) {
        var line = el('div', 'approval-row');
        var name = el('input');
        name.type = 'text';
        name.value = row.name;
        name.placeholder = A.text.name;
        name.setAttribute('aria-label', A.text.name + ' ' + (i + 1));
        name.disabled = !!opts.readOnly;
        name.addEventListener('input', function () {
          row.name = name.value;
          write();
        });
        var role = el('select');
        role.setAttribute('aria-label', A.text.role + ' ' + (i + 1));
        role.disabled = !!opts.readOnly;
        var choices = A.roles.slice();
        if (choices.indexOf(row.role) < 0) choices.push(row.role);
        choices.forEach(function (r) {
          var o = el('option', null, r);
          o.value = r;
          role.appendChild(o);
        });
        role.value = row.role;
        role.addEventListener('change', function () {
          row.role = role.value;
          write();
        });
        line.appendChild(name);
        line.appendChild(role);
        if (!opts.readOnly) {
          var remove = el('button', 'icon-btn', '×');
          remove.type = 'button';
          remove.setAttribute('aria-label', A.text.remove + ' ' + (row.name || i + 1));
          remove.addEventListener('click', function () {
            rows.splice(i, 1);
            draw();
            write();
          });
          line.appendChild(remove);
        }
        list.appendChild(line);
      });
    }

    draw();
    if (!opts.readOnly) {
      var tools = el('div', 'approval-tools');
      var add = el('button', 'link-btn', '+ ' + A.text.add);
      add.type = 'button';
      add.addEventListener('click', function () {
        rows.push({ name: '', role: A.roles[0], date: '', handle: '' });
        draw();
        var inputs = list.querySelectorAll('input');
        inputs[inputs.length - 1].focus();
      });
      tools.appendChild(add);
      if (A.example) {
        var ex = el('button', 'link-btn', A.text.example);
        ex.type = 'button';
        ex.addEventListener('click', function () {
          rows = A.example().map(function (p) { return { name: p.name, role: p.role, date: '', handle: '' }; });
          draw();
          write();
        });
        tools.appendChild(ex);
      }
      box.appendChild(tools);
    }
    box.focusFirst = function () {
      var inputs = Array.prototype.slice.call(list.querySelectorAll('input'));
      var empty = inputs.filter(function (i) { return !i.value.trim(); })[0];
      (empty || inputs[0] || box.querySelector('button') || box).focus();
    };
    return box;
  }

  /**
   * Render a form model into `container`.
   * opts: { readOnly, dir, text: { optional }, onInput(field, value),
   *         approvals: { key, roles, today, parse, format, example, text },
   *         decorate(field, element) — fills an element under a text field, again on every change }
   * Returns { focus(key), setIssues({ key: [messages] }) }.
   */
  function render(container, m, opts) {
    opts = opts || {};
    var text = opts.text || {};
    var controls = {};
    var issueSlots = {};
    container.innerHTML = '';
    m.fields.forEach(function (field) {
      var id = 'd2s-field-' + ++uid;
      var wrap = el('div', 'field');
      wrap.setAttribute('data-key', field.key);
      var head = el('div', 'field-head');
      var label = el('label', 'field-label', field.label);
      label.htmlFor = id;
      head.appendChild(label);
      if (field.optional) head.appendChild(el('span', 'badge', text.optional || 'optional'));
      wrap.appendChild(head);
      var describedBy = [];
      // Approval rows explain themselves: their note replaces the template's line-format guidance.
      var rows = opts.approvals && field.key === opts.approvals.key && !opts.approvals.parse(field.value).some(function (p) { return !p.ok; });
      var helperText = rows ? opts.approvals.text.note : field.helper;
      if (helperText) {
        var help = el('p', 'field-help', helperText);
        help.id = id + '-help';
        describedBy.push(help.id);
        wrap.appendChild(help);
      }
      var issues = el('div', 'field-issues');
      issues.id = id + '-issues';
      issues.setAttribute('aria-live', 'polite');
      describedBy.push(issues.id);

      var emit = function (value) {
        field.value = value;
        if (opts.onInput) opts.onInput(field, value);
      };
      var control = opts.approvals && field.key === opts.approvals.key ? approvalRows(field, opts, emit) : null;
      if (control) {
        control.id = id;
        control.setAttribute('role', 'group');
        control.setAttribute('aria-labelledby', id + '-label');
        label.id = id + '-label';
        label.removeAttribute('for');
        label.addEventListener('click', function () { control.focusFirst(); });
        controls[field.key] = { focus: control.focusFirst, root: control };
        wrap.appendChild(control);
      } else {
        var area = el('textarea');
        area.id = id;
        area.value = field.value;
        area.rows = 3;
        area.spellcheck = true;
        area.readOnly = !!opts.readOnly;
        if (opts.dir) area.dir = opts.dir;
        area.setAttribute('aria-describedby', describedBy.join(' '));
        var extra = el('div', 'field-extra');
        area.addEventListener('input', function () {
          grow(area);
          emit(area.value);
          if (opts.decorate) opts.decorate(field, extra);
        });
        controls[field.key] = { focus: function () { area.focus(); }, root: area };
        wrap.appendChild(area);
        if (opts.decorate) {
          opts.decorate(field, extra);
          wrap.appendChild(extra);
        }
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { grow(area); });
      }
      wrap.appendChild(issues);
      issueSlots[field.key] = { slot: issues, wrap: wrap };
      container.appendChild(wrap);
    });

    function focus(key) {
      var c = controls[key];
      if (!c) return;
      if (c.root.scrollIntoView) c.root.scrollIntoView({ block: 'center', behavior: 'smooth' });
      c.focus();
    }

    return {
      focus: focus,
      /** Fit every text field to its content again, e.g. after the layout width changed. */
      resize: function () {
        Array.prototype.forEach.call(container.querySelectorAll('textarea'), grow);
      },
      setIssues: function (byKey) {
        Object.keys(issueSlots).forEach(function (key) {
          var s = issueSlots[key];
          var messages = byKey[key] || [];
          s.slot.innerHTML = '';
          s.wrap.classList.toggle('has-issue', messages.length > 0);
          messages.forEach(function (message) {
            var b = el('button', 'issue', message);
            b.type = 'button';
            b.addEventListener('click', function () { focus(key); });
            s.slot.appendChild(b);
          });
        });
      },
    };
  }

  var api = { model: model, setField: setField, applyDocument: applyDocument, keyOf: keyOf, labelOf: labelOf, markdown: markdown, render: render };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.D2SForm = api;
})(typeof window !== 'undefined' ? window : this);
