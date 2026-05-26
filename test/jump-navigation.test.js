const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getJumpBubbleTargets,
  selectPreviousJumpTarget,
  selectNextJumpTarget,
} = require('../jump-navigation');

function makeBubble(top, label) {
  return {
    label,
    getBoundingClientRect() {
      return { top };
    },
  };
}

function makeButton(parentElement) {
  return { parentElement };
}

test('getJumpBubbleTargets uses injected toggle buttons and preserves bubble order', () => {
  const first = makeBubble(240, 'first');
  const second = makeBubble(80, 'second');
  const third = makeBubble(480, 'third');

  const doc = {
    querySelectorAll(selector) {
      assert.equal(selector, '.cgcc-toggle-btn');
      return [makeButton(first), makeButton(first), makeButton(second), makeButton(third)];
    },
    contains(node) {
      return node === first || node === second || node === third;
    },
  };

  const targets = getJumpBubbleTargets(doc);

  assert.deepEqual(targets.map((target) => target.element.label), ['second', 'first', 'third']);
  assert.deepEqual(targets.map((target) => target.viewportTop), [80, 240, 480]);
});

test('selectPreviousJumpTarget returns the last bubble above the viewport', () => {
  const first = makeBubble(-240, 'first');
  const second = makeBubble(-60, 'second');
  const third = makeBubble(120, 'third');
  const targets = [
    { element: first, viewportTop: first.getBoundingClientRect().top },
    { element: second, viewportTop: second.getBoundingClientRect().top },
    { element: third, viewportTop: third.getBoundingClientRect().top },
  ];

  assert.equal(selectPreviousJumpTarget(targets)?.label, 'second');
});

test('selectPreviousJumpTarget falls back to the first bubble when nothing is above', () => {
  const first = makeBubble(40, 'first');
  const second = makeBubble(120, 'second');
  const targets = [
    { element: first, viewportTop: first.getBoundingClientRect().top },
    { element: second, viewportTop: second.getBoundingClientRect().top },
  ];

  assert.equal(selectPreviousJumpTarget(targets)?.label, 'first');
});

test('selectNextJumpTarget returns the next bubble below the viewport top', () => {
  const first = makeBubble(-180, 'first');
  const second = makeBubble(30, 'second');
  const third = makeBubble(200, 'third');
  const targets = [
    { element: first, viewportTop: first.getBoundingClientRect().top },
    { element: second, viewportTop: second.getBoundingClientRect().top },
    { element: third, viewportTop: third.getBoundingClientRect().top },
  ];

  assert.equal(selectNextJumpTarget(targets)?.label, 'second');
});

test('selectNextJumpTarget returns null when every bubble is already above the threshold', () => {
  const first = makeBubble(-120, 'first');
  const second = makeBubble(-20, 'second');
  const targets = [
    { element: first, viewportTop: first.getBoundingClientRect().top },
    { element: second, viewportTop: second.getBoundingClientRect().top },
  ];

  assert.equal(selectNextJumpTarget(targets), null);
});