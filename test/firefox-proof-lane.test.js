const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const proofPs1 = fs.readFileSync(path.join(repoRoot, 'scripts', 'proof', 'prove-firefox-extension.ps1'), 'utf8');
const proofPy = fs.readFileSync(path.join(repoRoot, 'scripts', 'proof', 'prove-firefox-extension.py'), 'utf8');
const contentScript = fs.readFileSync(path.join(repoRoot, 'content-script.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));

test('manifest content script list only includes the runtime content script', () => {
  assert.deepEqual(manifest.content_scripts[0].js, ['content-script.js']);
  assert.equal(manifest.content_scripts[0].js.includes('jump-navigation.js'), false);
});

test('PowerShell proof lane checks required local dependencies', () => {
  assert.ok(proofPs1.includes('BLOCKED_MISSING_XPI'));
  assert.ok(proofPs1.includes('BLOCKED_MISSING_PYTHON'));
  assert.ok(proofPs1.includes('BLOCKED_MISSING_FIREFOX'));
  assert.ok(proofPs1.includes('BLOCKED_MISSING_SELENIUM'));
  assert.ok(proofPs1.includes('BLOCKED_MISSING_GECKODRIVER'));
  assert.ok(proofPs1.includes('CGCC_FIREFOX_PROFILE'));
  assert.ok(proofPs1.includes('prove-firefox-extension.py'));
});

test('Python proof lane reports auth or no conversation blockage clearly', () => {
  assert.ok(proofPy.includes('BLOCKED_AUTH_OR_NO_CONVERSATION'));
  assert.ok(proofPy.includes("document.querySelectorAll('.cgcc-toggle-btn').length"));
  assert.ok(proofPy.includes("driver.install_addon(str(xpi_path), temporary=True)"));
  assert.ok(proofPy.includes('scroll-proof.json'));
  assert.ok(proofPy.includes('console-checks.json'));
  assert.ok(proofPy.includes('down-before.png'));
  assert.ok(proofPy.includes('up-after.png'));
});

test('content script exposes a page-visible load bridge for proof', () => {
  assert.ok(contentScript.includes('window.__CGCC_LOADED__ = true;'));
  assert.ok(contentScript.includes('window.wrappedJSObject.__CGCC_LOADED__ = true;'));
});
