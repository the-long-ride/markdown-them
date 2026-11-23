import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, createRef } from 'react';
import { useDom } from './app-dom.mjs';

const require = createRequire(import.meta.url);
const { Tooltip } = require('../../out/app/components/Tooltip.js');

test('tooltip forwards ref and handlers, flips near each edge and dismisses on escape', async (t) => {
  const { window, render, click, emit, get, until } = useDom(t);
  const originalRect = window.HTMLElement.prototype.getBoundingClientRect;
  let bounds;
  t.mock.method(window.HTMLElement.prototype, 'getBoundingClientRect', function () {
    if (this.classList.contains('trigger')) return new window.DOMRect(...bounds);
    if (this.classList.contains('app-tooltip')) return new window.DOMRect(0, 0, 50, 20);
    return originalRect.call(this);
  });
  let focused = 0;
  let blurred = 0;
  let entered = 0;
  let left = 0;
  let pressed = 0;
  let clicked = 0;
  let refNode;
  const triggerRef = createRef();
  const renderTooltip = (props, ref = triggerRef) =>
    render(Tooltip, {
      delay: 0,
      content: 'Action help',
      shortcut: 'Ctrl+K',
      wrap: true,
      ...props,
      children: createElement(
        'button',
        {
          className: 'trigger',
          title: 'Native tooltip is suppressed',
          ref,
          onFocus: () => focused++,
          onBlur: () => blurred++,
          onMouseEnter: () => entered++,
          onMouseLeave: () => left++,
          onMouseDown: () => pressed++,
          onClick: () => clicked++,
        },
        'Action',
      ),
    });
  const getTooltip = () => window.document.querySelector('[role=tooltip]');
  const mouse = { eventClass: window.MouseEvent };
  for (const [position, coordinates, effective] of [
    ['top', [10, 2, 30, 10], 'bottom'],
    ['bottom', [10, window.innerHeight - 8, 30, 8], 'top'],
    ['left', [0, 90, 30, 10], 'right'],
    ['right', [window.innerWidth - 30, 90, 30, 10], 'left'],
  ]) {
    bounds = coordinates;
    await renderTooltip({ position });
    const trigger = get('.trigger');
    assert.equal(triggerRef.current, trigger);
    assert.equal(trigger.hasAttribute('title'), false);
    await emit(trigger, 'focusin', { eventClass: window.FocusEvent });
    await until(() => getTooltip()?.style.visibility === 'visible');
    assert.ok(getTooltip().classList.contains(`app-tooltip--${effective}`));
    assert.ok(getTooltip().classList.contains('app-tooltip--multiline'));
    assert.equal(getTooltip().querySelector('kbd').textContent, 'Ctrl+K');
    await emit(window, 'resize');
    await emit(window, 'scroll');
    await emit(window, 'keydown', { eventClass: window.KeyboardEvent, key: 'ArrowDown' });
    assert.ok(getTooltip());
    await emit(window, 'keydown', { eventClass: window.KeyboardEvent, key: 'Escape' });
    assert.equal(getTooltip(), null);
    await emit(trigger, 'focusout', { eventClass: window.FocusEvent });
  }
  assert.equal(focused, 4);
  assert.equal(blurred, 4);
  await renderTooltip({ disabled: true }, (node) => {
    refNode = node;
  });
  assert.equal(refNode, get('.trigger'));
  await emit(refNode, 'mouseover', mouse);
  await click(refNode);
  assert.equal(getTooltip(), null);
  await renderTooltip({ delay: 1000 });
  await emit(get('.trigger'), 'mouseover', mouse);
  await emit(get('.trigger'), 'mouseout', mouse);
  await emit(get('.trigger'), 'mousedown', mouse);
  assert.equal(getTooltip(), null);
  assert.deepEqual([entered, left, pressed, clicked], [2, 1, 1, 1]);
  await render(Tooltip, { content: 'ignored', children: 'Plain content' });
  assert.equal(get('#root').textContent, 'Plain content');
});
