const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  getJumpBubbleTargets,
  selectPreviousJumpTarget,
  selectNextJumpTarget,
} = require('../jump-navigation');

const repoRoot = path.resolve(__dirname, '..');

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
  assert.equal(targets[0].button.parentElement.label, 'second');
});

test('getJumpBubbleTargets returns an empty list when there are no collapse buttons', () => {
  const doc = {
    querySelectorAll(selector) {
      assert.equal(selector, '.cgcc-toggle-btn');
      return [];
    },
    contains() {
      return false;
    },
  };

  assert.deepEqual(getJumpBubbleTargets(doc), []);
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

test('manifest loads only content-script.js at runtime', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.content_scripts[0].js, ['content-script.js']);
  assert.equal(manifest.content_scripts[0].js.includes('jump-navigation.js'), false);
});

test('content script owns the jump helper and recovery path', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'content-script.js'), 'utf8');
  assert.ok(source.includes('function getJumpBubbleTargets()'), 'runtime jump helper missing');
  assert.ok(source.includes('async function refreshJumpTargetsOnce()'), 'recovery helper missing');
  assert.ok(source.includes("CONFIG.jumpNavEnabled === false"), 'strict false hide/show contract missing');
  assert.ok(source.includes("logJumpNavigatorDiagnostics('nav-state'"), 'navigator diagnostics missing');
  assert.ok(source.includes("logJumpNavigatorDiagnostics('previous'"), 'previous diagnostics missing');
  assert.ok(source.includes("logJumpNavigatorDiagnostics('next'"), 'next diagnostics missing');
});

test('init fails open and creates the navigator before bubble processing', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'content-script.js'), 'utf8');
  const initStart = source.indexOf('async function init() {');
  const initEnd = source.indexOf('// Setup navigation detection (SPA routing)');
  assert.ok(initStart >= 0, 'init function not found');
  assert.ok(initEnd > initStart, 'init function end marker not found');

  const initBlock = source.slice(initStart, initEnd);
  const loadSettingsIndex = initBlock.indexOf('await loadSettings();');
  const ensureNavigatorIndex = initBlock.indexOf('ensureJumpNavigator();');
  const detectIndex = initBlock.indexOf('await detectAndProcessBubbles(convState);');
  const tryIndex = initBlock.indexOf('try {');
  const catchIndex = initBlock.indexOf("log.error('initial bubble processing failed', err);");

  assert.ok(loadSettingsIndex >= 0, 'loadSettings call missing from init');
  assert.ok(ensureNavigatorIndex > loadSettingsIndex, 'navigator is not created after loadSettings');
  assert.ok(detectIndex > ensureNavigatorIndex, 'bubble processing starts before navigator creation');
  assert.ok(tryIndex > ensureNavigatorIndex, 'init is not wrapped in a fail-open try block');
  assert.ok(catchIndex > detectIndex, 'initial bubble processing failure is not logged');
});