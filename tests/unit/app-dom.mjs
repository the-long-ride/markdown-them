import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';

export function useDom(t, url = 'https://example.test/converter/') {
  const { window } = new JSDOM('<!doctype html><meta name="theme-color"><div id="root"></div>', {
    url,
    pretendToBeVisual: true,
  });
  const animations = [];
  const downloads = [];
  const clipboard = [];
  window.matchMedia = (query) => ({ matches: false, media: query });
  window.HTMLElement.prototype.animate = function (frames, timing) {
    animations.push({ node: this, frames, timing });
  };
  const createObjectURL = t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', function () {
    downloads.push(this.download);
  });
  window.navigator.clipboard = { writeText: async (text) => clipboard.push(text) };

  const globals = {
    ...Object.fromEntries(
      ['window', 'document', 'navigator', 'localStorage', 'CustomEvent', 'HTMLElement'].map(
        (key) => [key, key === 'window' ? window : window[key]],
      ),
    ),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previousGlobals = Object.keys(globals).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(globalThis, key),
  ]);
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }

  let root;
  async function render(Component, props) {
    const { createRoot } = await import('react-dom/client');
    root ??= createRoot(window.document.getElementById('root'));
    await act(async () => root.render(createElement(Component, props)));
  }

  async function cleanup() {
    if (root) {
      await act(async () => root.unmount());
      root = undefined;
    }
  }

  t.after(async () => {
    await cleanup();
    window.close();
    for (const [key, previous] of previousGlobals) {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    }
  });
  function get(selector) {
    const node = window.document.querySelector(selector);
    assert.ok(node, `Expected DOM node: ${selector}`);
    return node;
  }
  async function emit(target, type, options = {}, properties = {}) {
    const Event = options.eventClass ?? window.Event;
    const event = new Event(type, { bubbles: true, cancelable: true, ...options });
    Object.assign(event, properties);
    await act(async () => target.dispatchEvent(event));
    return event;
  }
  function click(selector) {
    const node = typeof selector === 'string' ? get(selector) : selector;
    return emit(node, 'click', { eventClass: window.MouseEvent });
  }
  async function changeText(selector, text) {
    const node = get(selector);
    const value = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    value.set.call(node, text);
    await emit(node, 'input');
  }
  async function until(predicate) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (predicate()) return;
      await act(async () => setTimeout(10));
    }
    assert.fail('The expected DOM update did not occur');
  }
  return {
    window,
    animations,
    downloads,
    clipboard,
    createObjectURL,
    render,
    cleanup,
    get,
    emit,
    click,
    changeText,
    until,
  };
}
