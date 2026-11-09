'use strict';

// A small stand-in for the browser, enough to run the plugin's panel (ui.js with the
// stage form and the GitHub client) in tests, without a browser: elements, text,
// attributes, classes, events and simple selectors (a tag name or a .class).
// It renders nothing. Setting innerHTML clears an element; the HTML isn't parsed.

function createFakeDom() {
  const document = { activeElement: null };

  class Event {
    constructor(type, init = {}) {
      this.type = type;
      this.bubbles = !!init.bubbles;
      this.defaultPrevented = false;
      this.target = null;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
    stopPropagation() {}
  }

  class Text {
    constructor(text) {
      this.nodeType = 3;
      this.data = String(text);
      this.parentNode = null;
    }
    get textContent() {
      return this.data;
    }
  }

  class Element {
    constructor(tag) {
      this.nodeType = 1;
      this.tagName = String(tag).toUpperCase();
      this.childNodes = [];
      this.parentNode = null;
      this.attributes = {};
      this.listeners = {};
      this.style = {};
      this.className = '';
      this.id = '';
      this.value = '';
      this.hidden = false;
      this.disabled = false;
      this.readOnly = false;
      const names = () => this.className.split(/\s+/).filter(Boolean);
      this.classList = {
        contains: (c) => names().includes(c),
        add: (...cs) => {
          this.className = [...new Set(names().concat(cs))].join(' ');
        },
        remove: (...cs) => {
          this.className = names().filter((n) => !cs.includes(n)).join(' ');
        },
        toggle: (c, force) => {
          const on = force === undefined ? !this.classList.contains(c) : !!force;
          if (on) this.classList.add(c);
          else this.classList.remove(c);
          return on;
        },
      };
    }
    get children() {
      return this.childNodes.filter((n) => n.nodeType === 1);
    }
    get textContent() {
      return this.childNodes.map((n) => n.textContent).join('');
    }
    set textContent(text) {
      this.childNodes.forEach((n) => (n.parentNode = null));
      this.childNodes = [];
      if (text !== '' && text !== null && text !== undefined) this.appendChild(new Text(text));
    }
    get innerHTML() {
      return this.html || '';
    }
    set innerHTML(html) {
      this.textContent = '';
      this.html = String(html);
    }
    appendChild(node) {
      if (node.parentNode) node.parentNode.removeChild(node);
      node.parentNode = this;
      this.childNodes.push(node);
      return node;
    }
    removeChild(node) {
      const i = this.childNodes.indexOf(node);
      if (i >= 0) this.childNodes.splice(i, 1);
      node.parentNode = null;
      return node;
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === 'class') this.className = String(value);
      if (name === 'id') this.id = String(value);
    }
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    }
    removeAttribute(name) {
      delete this.attributes[name];
    }
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    }
    dispatchEvent(event) {
      if (!event.target) event.target = this;
      for (let node = this; node; node = event.bubbles ? node.parentNode : null) {
        ((node.listeners && node.listeners[event.type]) || []).slice().forEach((fn) => fn.call(node, event));
      }
      return !event.defaultPrevented;
    }
    click() {
      if (!this.disabled) this.dispatchEvent(new Event('click', { bubbles: true }));
    }
    focus() {
      document.activeElement = this;
      this.dispatchEvent(new Event('focusin', { bubbles: true }));
    }
    select() {}
    scrollIntoView() {}
    contains(node) {
      for (let n = node; n; n = n.parentNode) if (n === this) return true;
      return false;
    }
    querySelectorAll(selector) {
      const match = selector.startsWith('.') ? (el) => el.classList.contains(selector.slice(1)) : (el) => el.tagName === selector.toUpperCase();
      const found = [];
      const walk = (el) =>
        el.children.forEach((c) => {
          if (match(c)) found.push(c);
          walk(c);
        });
      walk(this);
      return found;
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  }

  /** Every element under `root` (itself included) that `test` accepts. */
  function findAll(root, test) {
    const found = [];
    const walk = (el) => {
      if (test(el)) found.push(el);
      el.children.forEach(walk);
    };
    walk(root);
    return found;
  }

  Object.assign(document, {
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => new Text(text),
    documentElement: new Element('html'),
    body: new Element('body'),
    getElementById: (id) => findAll(document.documentElement, (el) => el.id === id)[0] || null,
    execCommand: () => false,
  });
  document.documentElement.appendChild(document.body);

  return { document, Event, findAll };
}

module.exports = { createFakeDom };
