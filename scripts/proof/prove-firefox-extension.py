#!/usr/bin/env python3
"""Local Firefox proof lane for the ChatGPT Bubble Collapse extension."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class ConsoleChecks:
    loaded: bool
    jump_nav_exists: bool
    jump_btn_count: int
    toggle_btn_count: int


@dataclass
class TargetSnapshot:
    index: int
    viewport_top: float
    class_name: str
    element_tag: str
    button_class_name: str
    button_aria_label: str


@dataclass
class ScrollSnapshot:
    scroll_container: dict[str, Any]
    first_visible_target: dict[str, Any] | None


JS_STATE_SCRIPT = r"""
function getJumpBubbleTargets() {
  const buttons = Array.from(document.querySelectorAll('.cgcc-toggle-btn'));
  const seen = new Set();
  const targets = [];

  for (const btn of buttons) {
    const bubble = btn.parentElement;
    if (!bubble || !document.contains(bubble) || seen.has(bubble)) continue;
    seen.add(bubble);
    targets.push({
      button: btn,
      element: bubble,
      viewportTop: bubble.getBoundingClientRect().top,
    });
  }

  targets.sort((a, b) => a.viewportTop - b.viewportTop);
  return targets;
}

function getScrollContainerForProof() {
  const buttons = Array.from(document.querySelectorAll('.cgcc-toggle-btn'));
  for (const btn of buttons) {
    let current = btn.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = getComputedStyle(current);
      const overflowY = style.overflowY;
      const scrollable = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && current.scrollHeight > (current.clientHeight + 50);
      if (scrollable) {
        return current;
      }
      current = current.parentElement;
    }
  }

  return document.scrollingElement || document.documentElement || document.body;
}

function getContainerSnapshot() {
  const container = getScrollContainerForProof();
  const isDocument = container === document.scrollingElement || container === document.documentElement || container === document.body;
  return {
    kind: isDocument ? 'document' : 'element',
    tagName: container && container.tagName ? container.tagName.toLowerCase() : 'unknown',
    id: container && container.id ? container.id : '',
    className: container && typeof container.className === 'string' ? container.className : '',
    scrollTop: isDocument ? (document.scrollingElement ? document.scrollingElement.scrollTop : (document.documentElement.scrollTop || document.body.scrollTop || 0)) : container.scrollTop,
    clientHeight: isDocument ? window.innerHeight : container.clientHeight,
    scrollHeight: isDocument ? (document.scrollingElement ? document.scrollingElement.scrollHeight : document.documentElement.scrollHeight) : container.scrollHeight,
  };
}

function getFirstVisibleTarget() {
  const targets = getJumpBubbleTargets();
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    const rect = target.element.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < window.innerHeight;
    if (visible) {
      return {
        index,
        viewportTop: rect.top,
        className: target.element.className,
        elementTag: target.element.tagName ? target.element.tagName.toLowerCase() : 'unknown',
        buttonClassName: target.button.className,
        buttonAriaLabel: target.button.getAttribute('aria-label') || '',
      };
    }
  }
  return null;
}

return {
  loaded: window.__CGCC_LOADED__ === true,
  jumpNavExists: document.querySelector('.cgcc-jump-nav') !== null,
  jumpBtnCount: document.querySelectorAll('.cgcc-jump-btn').length,
  toggleBtnCount: document.querySelectorAll('.cgcc-toggle-btn').length,
  scrollContainer: getContainerSnapshot(),
  firstVisibleTarget: getFirstVisibleTarget(),
};
"""

CLICK_WAIT_SCRIPT = r"""
const before = arguments[0];
const kind = arguments[1];
const timeoutMs = arguments[2] || 10000;
const done = arguments[arguments.length - 1];

function getJumpBubbleTargets() {
  const buttons = Array.from(document.querySelectorAll('.cgcc-toggle-btn'));
  const seen = new Set();
  const targets = [];

  for (const btn of buttons) {
    const bubble = btn.parentElement;
    if (!bubble || !document.contains(bubble) || seen.has(bubble)) continue;
    seen.add(bubble);
    targets.push({
      button: btn,
      element: bubble,
      viewportTop: bubble.getBoundingClientRect().top,
    });
  }

  targets.sort((a, b) => a.viewportTop - b.viewportTop);
  return targets;
}

function getScrollContainerForProof() {
  const buttons = Array.from(document.querySelectorAll('.cgcc-toggle-btn'));
  for (const btn of buttons) {
    let current = btn.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = getComputedStyle(current);
      const overflowY = style.overflowY;
      const scrollable = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && current.scrollHeight > (current.clientHeight + 50);
      if (scrollable) {
        return current;
      }
      current = current.parentElement;
    }
  }

  return document.scrollingElement || document.documentElement || document.body;
}

function snapshot() {
  const targets = getJumpBubbleTargets();
  const container = getScrollContainerForProof();
  const isDocument = container === document.scrollingElement || container === document.documentElement || container === document.body;
  let firstVisibleTarget = null;
  for (let index = 0; index < targets.length; index++) {
    const target = targets[index];
    const rect = target.element.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < window.innerHeight;
    if (visible) {
      firstVisibleTarget = {
        index,
        viewportTop: rect.top,
        className: target.element.className,
        elementTag: target.element.tagName ? target.element.tagName.toLowerCase() : 'unknown',
        buttonClassName: target.button.className,
        buttonAriaLabel: target.button.getAttribute('aria-label') || '',
      };
      break;
    }
  }

  return {
    scrollTop: isDocument ? (document.scrollingElement ? document.scrollingElement.scrollTop : (document.documentElement.scrollTop || document.body.scrollTop || 0)) : container.scrollTop,
    firstVisibleTarget,
  };
}

const start = Date.now();
const poll = window.setInterval(() => {
  const current = snapshot();
  const changed = JSON.stringify(current) !== JSON.stringify(before);
  if (kind === 'down') {
    if ((current.firstVisibleTarget && (!before.firstVisibleTarget || current.firstVisibleTarget.index !== before.firstVisibleTarget.index)) || current.scrollTop !== before.scrollTop || changed) {
      window.clearInterval(poll);
      done(current);
      return;
    }
  } else {
    if ((current.firstVisibleTarget && (!before.firstVisibleTarget || current.firstVisibleTarget.index !== before.firstVisibleTarget.index)) || current.scrollTop !== before.scrollTop || changed) {
      window.clearInterval(poll);
      done(current);
      return;
    }
  }

  if ((Date.now() - start) > timeoutMs) {
    window.clearInterval(poll);
    done(current);
  }
}, 250);
"""


def fail(code: str, message: str) -> int:
    print(code)
    print(message)
    return 1


def ensure_module(name: str, install_hint: str) -> None:
    try:
        __import__(name)
    except ImportError:
        print('BLOCKED_MISSING_SELENIUM')
        print('Python selenium is not installed.')
        print(install_hint)
        raise SystemExit(1)


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding='utf-8')


def write_summary(path: Path, title: str, lines: list[str]) -> None:
    body = [f'# {title}', '']
    body.extend(lines)
    path.write_text('\n'.join(body) + '\n', encoding='utf-8')


def collect_state(driver) -> dict[str, Any]:
    return driver.execute_script(JS_STATE_SCRIPT)


def click_and_wait(driver, button_css: str, kind: str, before_state: dict[str, Any], timeout_ms: int = 10000) -> dict[str, Any]:
    driver.find_element('css selector', button_css).click()
    return driver.execute_async_script(CLICK_WAIT_SCRIPT, before_state, kind, timeout_ms)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--xpi-path', required=True)
    parser.add_argument('--report-dir', required=True)
    parser.add_argument('--site-url', default='https://chatgpt.com/')
    parser.add_argument('--headless', action='store_true')
    args = parser.parse_args()

    ensure_module('selenium', 'Install with: python -m pip install selenium')

    from selenium import webdriver
    from selenium.common.exceptions import TimeoutException
    from selenium.webdriver.firefox.options import Options
    from selenium.webdriver.firefox.service import Service
    from selenium.webdriver.support.ui import WebDriverWait

    xpi_path = Path(args.xpi_path)
    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)

    if not xpi_path.exists():
      return fail('BLOCKED_MISSING_XPI', f'Missing XPI: {xpi_path}')

    geckodriver = os.environ.get('CGCC_GECKODRIVER_BINARY') or shutil.which('geckodriver')
    if not geckodriver:
        return fail(
            'BLOCKED_MISSING_GECKODRIVER',
            'geckodriver is not available on PATH. Install geckodriver and ensure geckodriver.exe is on PATH, then rerun.',
        )

    firefox_binary = os.environ.get('CGCC_FIREFOX_BINARY')
    if firefox_binary:
      firefox_path = Path(firefox_binary)
      if 'WindowsApps' not in firefox_binary and not firefox_path.exists():
        return fail('BLOCKED_MISSING_FIREFOX', f'Firefox binary not found: {firefox_binary}')
      if 'WindowsApps' in firefox_binary:
        firefox_binary = ''

    profile_path = os.environ.get('CGCC_FIREFOX_PROFILE')
    if profile_path and not Path(profile_path).exists():
        return fail('BLOCKED_MISSING_PROFILE', f'CGCC_FIREFOX_PROFILE does not exist: {profile_path}')

    options = Options()
    if args.headless or os.environ.get('CGCC_HEADLESS') == '1':
        options.add_argument('-headless')
    if firefox_binary:
        options.binary_location = firefox_binary

    if profile_path:
        from selenium.webdriver.firefox.firefox_profile import FirefoxProfile
        options.profile = FirefoxProfile(profile_path)

    service = Service(executable_path=geckodriver)
    driver = webdriver.Firefox(service=service, options=options)

    console_checks: dict[str, Any] = {}
    down_before: dict[str, Any] | None = None
    down_after: dict[str, Any] | None = None
    up_before: dict[str, Any] | None = None
    up_after: dict[str, Any] | None = None
    addon_id = ''
    classification = 'PASSED'
    summary_lines: list[str] = []

    try:
        addon_id = driver.install_addon(str(xpi_path), temporary=True)
        driver.get(args.site_url)
        WebDriverWait(driver, 30).until(lambda d: d.execute_script('return document.readyState') == 'complete')

        try:
            WebDriverWait(driver, 30).until(lambda d: d.execute_script('return window.__CGCC_LOADED__ === true'))
        except TimeoutException:
            pass

        console_checks = collect_state(driver)
        write_json(report_dir / 'console-checks.json', console_checks)

        if console_checks.get('toggleBtnCount', 0) == 0:
            classification = 'BLOCKED_AUTH_OR_NO_CONVERSATION'
            summary_lines = [
                f'Classification: {classification}',
                '',
                'No .cgcc-toggle-btn elements were present on the page.',
                'This usually means ChatGPT is not logged in or no conversation is open.',
            ]
            write_summary(report_dir / 'summary.md', 'Firefox Extension Proof', summary_lines)
            write_json(report_dir / 'scroll-proof.json', {
                'classification': classification,
                'down': None,
                'up': None,
                'addonId': addon_id,
            })
            print(classification)
            print(f'Report directory: {report_dir}')
            return 42

        down_before = collect_state(driver)
        driver.save_screenshot(str(report_dir / 'down-before.png'))
        down_after = click_and_wait(driver, '.cgcc-jump-btn[aria-label="Jump to next message"]', 'down', down_before)
        driver.save_screenshot(str(report_dir / 'down-after.png'))

        up_before = collect_state(driver)
        driver.save_screenshot(str(report_dir / 'up-before.png'))
        up_after = click_and_wait(driver, '.cgcc-jump-btn[aria-label="Jump to previous message"]', 'up', up_before)
        driver.save_screenshot(str(report_dir / 'up-after.png'))

        scroll_proof = {
            'classification': classification,
            'addonId': addon_id,
            'siteUrl': args.site_url,
            'consoleChecks': console_checks,
            'down': {
                'before': down_before,
                'after': down_after,
                'moved': down_before != down_after,
            },
            'up': {
                'before': up_before,
                'after': up_after,
                'moved': up_before != up_after,
            },
        }
        write_json(report_dir / 'scroll-proof.json', scroll_proof)

        summary_lines = [
            'Classification: PASSED',
            '',
            f'Addon ID: {addon_id}',
            f'Console checks: {json.dumps(console_checks, indent=2, sort_keys=True)}',
            '',
            f'Down moved: {down_before != down_after}',
            f'Up moved: {up_before != up_after}',
            '',
            'Artifacts:',
            '- console-checks.json',
            '- scroll-proof.json',
            '- down-before.png',
            '- down-after.png',
            '- up-before.png',
            '- up-after.png',
        ]
        write_summary(report_dir / 'summary.md', 'Firefox Extension Proof', summary_lines)
        print('PASSED')
        print(f'Report directory: {report_dir}')
        return 0
    finally:
        try:
            driver.quit()
        except Exception:
            pass


if __name__ == '__main__':
    raise SystemExit(main())
