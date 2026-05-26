// Content script for ChatGPT Bubble Collapse extension
// Handles DOM detection, bubble manipulation, and state management

window.__CGCC_LOADED__ = true;

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // Logging
  // ─────────────────────────────────────────────
  const TAG = '[CGCC]';
  let debugEnabled = false;

  const log = {
    debug: (...a) => { if (debugEnabled) console.debug(TAG, ...a); },
    info:  (...a) => console.log(TAG, ...a),
    warn:  (...a) => console.warn(TAG, ...a),
    error: (...a) => console.error(TAG, ...a),
  };

  log.info('content script loaded', location.href);

  // ─────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────
  const CONFIG = {
    collapsedLines:   5,
    buttonVisibility: 'hover',     // 'hover' | 'always'
    persistence:      'perBubble', // 'off' | 'conversationDefault' | 'perBubble'
    defaultMode:      'expanded',  // 'expanded' | 'collapsed'
    jumpNavEnabled:   true,
    jumpScrollBehavior: 'smooth',  // 'smooth' | 'instant'
    debug:            false,
  };

  // ─────────────────────────────────────────────
  // State
  // NOTE: `let` (not `const`) is required so handleNavigation() can
  // replace the WeakMaps when the user navigates to a new conversation.
  // ─────────────────────────────────────────────
  let currentDefaultMode = 'expanded';
  let bubbleControlsMap  = new WeakMap(); // DOM element → toggle button
  let bubbleDataMap      = new WeakMap(); // DOM element → { key: string }

  // Per-session explicit user overrides, keyed by stable bubble key.
  // Survives React re-renders that swap the underlying DOM element so
  // that detectAndProcessBubbles() never overrides what the user chose.
  const userExplicitStates = new Map(); // bubbleKey → 'expanded' | 'collapsed'

  let mutationObserver  = null;
  let debounceTimer     = null;
  let processingLock    = false; // true while detectAndProcessBubbles is running
  let processingPending = false; // a call was skipped while locked
  let conversationKey   = null;
  let lastUrl           = window.location.href;
  let urlCheckInterval  = null;
  let jumpNavContainer  = null;
  let jumpNavListenersAttached = false;

  const JUMP_NAV = {
    verticalOffset: 90,
    horizontalGap: 12,
    topThreshold: 8,
  };

  // Simple FNV-1a hash implementation (32-bit)
  function fnv1aHash(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  // Get conversation key from URL
  function getConversationKey() {
    const path = window.location.pathname;
    const match = path.match(/\/c\/([^\/]+)/);
    if (match) {
      return match[1];
    }
    return path;
  }

  // Generate bubble key
  function generateBubbleKey(bubble, index) {
    // Prefer the stable server-assigned message ID (check container AND roleElement)
    const messageId = bubble.element.getAttribute('data-message-id')
      || bubble.roleElement.getAttribute('data-message-id');
    if (messageId) return messageId;

    // Derive a key from role + position + content fingerprint
    const bodyEl = getBubbleBody(bubble);
    const text   = bodyEl.textContent.trim().substring(0, 32);
    return `${bubble.role}-${index}-${fnv1aHash(text)}`;
  }

  // Load settings from storage
  async function loadSettings() {
    try {
      const result = await browser.storage.local.get('settings');
      if (result.settings) {
        Object.assign(CONFIG, result.settings);
        debugEnabled = !!CONFIG.debug;
        log.debug('Settings loaded', CONFIG);
      }
    } catch (err) {
      log.error('loadSettings failed', err);
    }
  }

  // Load conversation state from storage
  async function loadConversationState() {
    conversationKey = getConversationKey();
    log.debug('loadConversationState key=%s', conversationKey);
    try {
      const result        = await browser.storage.local.get('conversations');
      const conversations = result.conversations || {};
      const convState     = conversations[conversationKey];
      if (convState) {
        currentDefaultMode = convState.defaultMode || CONFIG.defaultMode;
        log.debug('Conversation state found', convState);
        return convState;
      }
    } catch (err) {
      log.error('loadConversationState failed', err);
    }
    currentDefaultMode = CONFIG.defaultMode;
    return null;
  }

  // Save conversation state to storage
  async function saveConversationState(bubbleStates = null) {
    try {
      const result        = await browser.storage.local.get('conversations');
      const conversations = result.conversations || {};
      const convState     = { defaultMode: currentDefaultMode, updatedAt: Date.now() };
      if (CONFIG.persistence === 'perBubble' && bubbleStates) {
        convState.bubbleStates = bubbleStates;
      }
      conversations[conversationKey] = convState;
      await browser.storage.local.set({ conversations });
      log.debug('Conversation state saved', convState);
    } catch (err) {
      log.error('saveConversationState failed', err);
    }
  }

  // Get all bubble states
  function getAllBubbleStates() {
    const bubbles = detectBubbles();
    const states = {};
    
    bubbles.forEach((bubble, index) => {
      const data = bubbleDataMap.get(bubble.element);
      if (data) {
        const isCollapsed = isBubbleCollapsed(bubble);
        states[data.key] = isCollapsed ? 'collapsed' : 'expanded';
      }
    });

    return states;
  }

  // Initialize
  async function init() {
    await loadSettings();
    ensureJumpNavigator();

    let convState = null;
    try {
      convState = await loadConversationState();
      await detectAndProcessBubbles(convState);
    } catch (err) {
      log.error('initial bubble processing failed', err);
    }

    ensureJumpNavigator();
    setupMutationObserver();
    setupMessageListener();
    setupNavigationDetection();
  }

  // Setup navigation detection (SPA routing)
  function setupNavigationDetection() {
    // Hook history API
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleNavigation();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      handleNavigation();
    };

    // Listen to popstate
    window.addEventListener('popstate', handleNavigation);

    // Fallback: poll URL changes
    urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleNavigation();
      }
    }, 1000);
  }

  async function handleNavigation() {
    log.info('Navigation \u2192 %s', window.location.href);
    // Reset all per-conversation state so no stale data bleeds across conversations
    bubbleControlsMap = new WeakMap();
    bubbleDataMap     = new WeakMap();
    userExplicitStates.clear();
    processingLock    = false;
    processingPending = false;
    ensureJumpNavigator();
    let convState = null;
    try {
      convState = await loadConversationState();
      await detectAndProcessBubbles(convState);
    } catch (err) {
      log.error('navigation bubble processing failed', err);
    }
    ensureJumpNavigator();
    updateJumpNavigatorPosition();
    setupMutationObserver(); // re-attach to potentially new root
  }

  function isDocumentScroller(scroller) {
    return (
      !scroller
      || scroller === window
      || scroller === document
      || scroller === document.documentElement
      || scroller === document.body
      || scroller === document.scrollingElement
    );
  }

  function getScrollTop(scroller) {
    if (isDocumentScroller(scroller)) {
      return window.scrollY
        || document.documentElement.scrollTop
        || document.body.scrollTop
        || 0;
    }
    return scroller.scrollTop || 0;
  }

  function getScrollBehavior() {
    return CONFIG.jumpScrollBehavior === 'instant' ? 'auto' : 'smooth';
  }

  function logJumpNavigatorDiagnostics(direction, targets, selectedTarget) {
    if (!debugEnabled) return;

    const selectedClassName = selectedTarget && selectedTarget.element && selectedTarget.element.className
      ? selectedTarget.element.className
      : 'none';
    const selectedTop = selectedTarget && typeof selectedTarget.viewportTop === 'number'
      ? Math.round(selectedTarget.viewportTop)
      : 'none';

    log.debug(
      'jump navigator diagnostics loaded=%s enabled=%s appended=%s direction=%s targets=%d selectedTop=%s selectedClass=%s',
      window.__CGCC_LOADED__,
      CONFIG.jumpNavEnabled,
      !!(jumpNavContainer && document.contains(jumpNavContainer)),
      direction,
      targets.length,
      selectedTop,
      selectedClassName,
    );
  }

  function scrollToPosition(scroller, top, behavior) {
    const safeTop = Math.max(0, Math.round(top));
    if (isDocumentScroller(scroller)) {
      window.scrollTo({ top: safeTop, behavior });
      return;
    }
    scroller.scrollTo({ top: safeTop, behavior });
  }

  function scrollByPosition(scroller, delta, behavior) {
    const safeDelta = Math.round(delta);
    if (isDocumentScroller(scroller)) {
      window.scrollBy({ top: safeDelta, behavior });
      return;
    }
    scroller.scrollBy({ top: safeDelta, behavior });
  }

  function getScrollerLabel(scroller) {
    if (isDocumentScroller(scroller)) return 'document';
    const tag = scroller.tagName ? scroller.tagName.toLowerCase() : 'unknown';
    const id = scroller.id ? `#${scroller.id}` : '';
    const classPart = scroller.className && typeof scroller.className === 'string'
      ? `.${scroller.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.')}`
      : '';
    return `${tag}${id}${classPart}`;
  }

  function isScrollableElement(el) {
    if (!el || !el.tagName) return false;
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const allowsScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    const hasRange = el.scrollHeight > (el.clientHeight + 50);
    return allowsScroll && hasRange;
  }

  function getMessageAnchorElements(root) {
    const anchors = [];
    const seen = new Set();

    const roleElements = root.querySelectorAll('[data-message-author-role]');
    for (const roleEl of roleElements) {
      const role = roleEl.getAttribute('data-message-author-role');
      if (role !== 'user' && role !== 'assistant') continue;
      if (!document.contains(roleEl) || seen.has(roleEl)) continue;
      seen.add(roleEl);
      anchors.push(roleEl);
    }

    if (anchors.length < 2) {
      for (const bubble of detectBubbles()) {
        const el = bubble.element;
        if (!el || !document.contains(el) || seen.has(el)) continue;
        seen.add(el);
        anchors.push(el);
      }
    }

    if (anchors.length < 2) {
      const turnWrappers = root.querySelectorAll('[data-testid*="conversation-turn"], [data-testid*="conversation_turn"]');
      for (const turnEl of turnWrappers) {
        if (!document.contains(turnEl) || seen.has(turnEl)) continue;
        seen.add(turnEl);
        anchors.push(turnEl);
      }
    }

    return anchors;
  }

  function getScrollableAncestors(el, root) {
    const result = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      if (current === root || current.contains(root) || root.contains(current)) {
        result.push(current);
      }
      current = current.parentElement;
    }
    return result;
  }

  function getActiveScrollContainer() {
    const root = getConversationRoot();
    const anchors = getMessageAnchorElements(root);
    const candidates = new Set();

    candidates.add(document.scrollingElement);
    candidates.add(document.documentElement);
    candidates.add(document.body);

    const main = document.querySelector('main');
    if (main) candidates.add(main);

    for (const anchor of anchors) {
      const ancestors = getScrollableAncestors(anchor, root);
      for (const ancestor of ancestors) {
        if (isScrollableElement(ancestor)) {
          candidates.add(ancestor);
        }
      }
    }

    const wrapperCandidates = root.querySelectorAll('[data-testid*="conversation-turn"], [data-testid*="conversation_turn"], [class*="conversation"], [class*="thread"]');
    for (const node of wrapperCandidates) {
      if (isScrollableElement(node)) {
        candidates.add(node);
      }
      for (const ancestor of getScrollableAncestors(node, root)) {
        if (isScrollableElement(ancestor)) {
          candidates.add(ancestor);
        }
      }
    }

    let best = document.scrollingElement || document.documentElement;
    let bestScore = -1;

    for (const candidate of candidates) {
      if (!candidate) continue;

      const isDoc = isDocumentScroller(candidate);
      const scrollRange = isDoc
        ? Math.max(0, (document.scrollingElement?.scrollHeight || document.documentElement.scrollHeight || 0) - window.innerHeight)
        : Math.max(0, candidate.scrollHeight - candidate.clientHeight);
      if (scrollRange <= 0) continue;

      const containsAnchor = anchors.length === 0
        ? true
        : anchors.some((anchor) => isDoc || candidate.contains(anchor));

      const score = (containsAnchor ? 1_000_000 : 0) + scrollRange;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best || document.scrollingElement || document.documentElement;
  }

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
    log.debug('getJumpBubbleTargets: %d targets', targets.length);
    return targets;
  }

  function scrollToBubbleTop(scroller, targetTop) {
    const behavior = getScrollBehavior();
    scrollToPosition(scroller, targetTop, behavior);
  }

  function scrollByViewport(scroller, direction) {
    const behavior = getScrollBehavior();
    const viewportHeight = isDocumentScroller(scroller)
      ? window.innerHeight
      : scroller.clientHeight;
    const viewportStep = Math.max(200, Math.round(viewportHeight * 0.85));
    scrollByPosition(scroller, viewportStep * direction, behavior);
  }

  function removeJumpNavigator() {
    if (jumpNavContainer && document.contains(jumpNavContainer)) {
      jumpNavContainer.remove();
    }
    jumpNavContainer = null;
  }

  async function refreshJumpTargetsOnce() {
    try {
      await detectAndProcessBubbles();
    } catch (err) {
      log.error('jump navigator recovery failed', err);
      return [];
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    return getJumpBubbleTargets();
  }

  async function navigateToPreviousBubble() {
    let targets = getJumpBubbleTargets();
    logJumpNavigatorDiagnostics('previous', targets, null);

    if (targets.length === 0) {
      targets = await refreshJumpTargetsOnce();
    }

    if (targets.length === 0) {
      log.warn('jump-up: no toggle buttons found');
      logJumpNavigatorDiagnostics('previous', targets, null);
      return;
    }

    let dest = null;
    for (const target of targets) {
      if (target.viewportTop < -10) dest = target.element;
    }

    if (!dest) {
      dest = targets[0].element;
    }

    const behavior = getScrollBehavior();
    const selectedTarget = targets.find((target) => target.element === dest) || null;
    logJumpNavigatorDiagnostics('previous', targets, selectedTarget);
    dest.scrollIntoView({ behavior, block: 'start' });
  }

  async function navigateToNextBubble() {
    let targets = getJumpBubbleTargets();
    logJumpNavigatorDiagnostics('next', targets, null);

    if (targets.length === 0) {
      targets = await refreshJumpTargetsOnce();
    }

    if (targets.length === 0) {
      log.warn('jump-down: no toggle buttons found');
      logJumpNavigatorDiagnostics('next', targets, null);
      return;
    }

    const nextTarget = targets.find((target) => target.viewportTop > 10) || null;

    if (!nextTarget) {
      log.debug('jump-down: already at last target');
      logJumpNavigatorDiagnostics('next', targets, null);
      return;
    }

    const behavior = getScrollBehavior();
    logJumpNavigatorDiagnostics('next', targets, nextTarget);
    nextTarget.element.scrollIntoView({ behavior, block: 'start' });
  }

  function updateJumpNavigatorPosition() {
    if (!jumpNavContainer || !document.contains(jumpNavContainer)) return;

    const main = document.querySelector('main');
    if (!main) {
      jumpNavContainer.style.right = '12px';
      jumpNavContainer.style.left = 'auto';
      return;
    }

    const rect = main.getBoundingClientRect();
    const navWidth = jumpNavContainer.offsetWidth || 44;
    const desiredLeft = rect.right + JUMP_NAV.horizontalGap;
    const maxLeft = window.innerWidth - navWidth - 12;
    const minLeft = 12;
    const clampedLeft = Math.min(maxLeft, Math.max(minLeft, desiredLeft));

    jumpNavContainer.style.left = `${Math.round(clampedLeft)}px`;
    jumpNavContainer.style.right = 'auto';
  }

  function ensureJumpNavigator() {
    if (CONFIG.jumpNavEnabled === false) {
      removeJumpNavigator();
      logJumpNavigatorDiagnostics('nav-state', getJumpBubbleTargets(), null);
      return;
    }

    if (jumpNavContainer && document.contains(jumpNavContainer)) {
      logJumpNavigatorDiagnostics('nav-state', getJumpBubbleTargets(), null);
      return;
    }

    jumpNavContainer = document.createElement('div');
    jumpNavContainer.className = 'cgcc-jump-nav';
    jumpNavContainer.setAttribute('role', 'group');
    jumpNavContainer.setAttribute('aria-label', 'Message navigation');

    const upButton = document.createElement('button');
    upButton.className = 'cgcc-jump-btn';
    upButton.setAttribute('type', 'button');
    upButton.setAttribute('aria-label', 'Jump to previous message');
    upButton.textContent = '\u2191';

    const downButton = document.createElement('button');
    downButton.className = 'cgcc-jump-btn';
    downButton.setAttribute('type', 'button');
    downButton.setAttribute('aria-label', 'Jump to next message');
    downButton.textContent = '\u2193';

    upButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigateToPreviousBubble();
    });

    downButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigateToNextBubble();
    });

    jumpNavContainer.appendChild(upButton);
    jumpNavContainer.appendChild(downButton);
    document.body.appendChild(jumpNavContainer);

    jumpNavContainer.style.top = `${JUMP_NAV.verticalOffset}px`;

    if (!jumpNavListenersAttached) {
      window.addEventListener('resize', updateJumpNavigatorPosition, { passive: true });
      window.addEventListener('scroll', updateJumpNavigatorPosition, { passive: true });
      jumpNavListenersAttached = true;
    }

    updateJumpNavigatorPosition();
    logJumpNavigatorDiagnostics('nav-state', getJumpBubbleTargets(), null);
  }

  // Detect conversation root
  function getConversationRoot() {
    // Prefer main element
    const main = document.querySelector('main');
    if (main) return main;
    // Fallback to body
    return document.body;
  }

  /**
   * Detect all message bubbles and return them as { element, role, roleElement }.
   *
   * Container selection uses a stable, height-independent strategy:
   *   1. Walk up to the nearest ancestor with `data-message-id` — the most stable
   *      ChatGPT marker, fixed at message creation and unchanged during streaming.
   *   2. Walk up (max 8 levels) to the nearest ancestor with class `group`.
   *   3. Fall back to the roleElement itself.
   *
   * Results are deduplicated by container element so that multiple roleElements
   * inside the same container (e.g. thinking-block + response text) produce only
   * ONE bubble — eliminating the duplicate-button problem.
   */
  function detectBubbles() {
    const root         = getConversationRoot();
    const seen         = new Set();
    const bubbles      = [];
    const roleElements = root.querySelectorAll('[data-message-author-role]');

    log.debug('detectBubbles: %d role elements in DOM', roleElements.length);

    for (const roleEl of roleElements) {
      const role = roleEl.getAttribute('data-message-author-role');
      if (role !== 'user' && role !== 'assistant') continue;

      let container = roleEl;

      // Strategy 1: anchor to data-message-id (stable across streaming)
      let el = roleEl;
      while (el && el !== root) {
        if (el.hasAttribute('data-message-id')) {
          container = el;
          break;
        }
        el = el.parentElement;
      }

      // Strategy 2: anchor to .group ancestor (only if strategy 1 failed)
      if (container === roleEl) {
        el = roleEl.parentElement;
        let depth = 0;
        while (el && el !== root && depth < 8) {
          if (el.classList.contains('group')) {
            container = el;
            break;
          }
          el = el.parentElement;
          depth++;
        }
      }

      // Skip duplicates (multiple roleElements resolving to the same container)
      if (seen.has(container)) {
        log.debug('detectBubbles: deduplicated container for role=%s', role);
        continue;
      }
      seen.add(container);

      bubbles.push({ element: container, role, roleElement: roleEl });
    }

    log.debug('detectBubbles: returning %d unique bubbles', bubbles.length);
    return bubbles;
  }

  // Get the body element within a bubble to apply collapse
  function getBubbleBody(bubble) {
    // Look for markdown content or main content container
    const markdownEl = bubble.element.querySelector('.markdown, [class*="markdown"]');
    if (markdownEl) return markdownEl;

    // Look for content wrapper
    const contentEl = bubble.element.querySelector('[class*="content"], [class*="message"]');
    if (contentEl) return contentEl;

    // Fallback: use the bubble element itself
    return bubble.element;
  }

  // Compute collapsed height for a body element
  function computeCollapsedHeight(bodyEl) {
    const style = window.getComputedStyle(bodyEl);
    let lineHeight = parseFloat(style.lineHeight);
    
    // If line-height is "normal", estimate from font-size
    if (isNaN(lineHeight) || lineHeight === 0) {
      const fontSize = parseFloat(style.fontSize);
      lineHeight = fontSize * 1.4;
    }

    const paddingAllowance = 12;
    return lineHeight * CONFIG.collapsedLines + paddingAllowance;
  }

  // Collapse a bubble
  function collapseBubble(bubble) {
    try {
      const bodyEl = getBubbleBody(bubble);
      if (!bodyEl || !document.contains(bodyEl)) return;
      const maxH = computeCollapsedHeight(bodyEl);
      bodyEl.style.maxHeight = `${maxH}px`;
      bodyEl.style.overflow  = 'hidden';
      bubble.element.classList.add('cgcc-collapsed');
      const btn = bubbleControlsMap.get(bubble.element);
      if (btn) {
        btn.textContent = 'Expand';
        btn.setAttribute('aria-label', 'Expand message');
      }
      log.debug('collapseBubble key=%s', bubbleDataMap.get(bubble.element)?.key);
    } catch (err) {
      log.warn('collapseBubble error', err);
    }
  }

  // Expand a bubble
  function expandBubble(bubble) {
    try {
      const bodyEl = getBubbleBody(bubble);
      if (!bodyEl || !document.contains(bodyEl)) return;
      bodyEl.style.maxHeight = '';
      bodyEl.style.overflow  = '';
      bubble.element.classList.remove('cgcc-collapsed');
      const btn = bubbleControlsMap.get(bubble.element);
      if (btn) {
        btn.textContent = 'Collapse';
        btn.setAttribute('aria-label', 'Collapse message');
      }
      log.debug('expandBubble key=%s', bubbleDataMap.get(bubble.element)?.key);
    } catch (err) {
      log.warn('expandBubble error', err);
    }
  }

  // Check if a bubble is collapsed
  function isBubbleCollapsed(bubble) {
    return bubble.element.classList.contains('cgcc-collapsed');
  }

  // Toggle a bubble's collapse state
  function toggleBubble(bubble) {
    const wasCollapsed = isBubbleCollapsed(bubble);
    if (wasCollapsed) {
      expandBubble(bubble);
    } else {
      collapseBubble(bubble);
    }

    // Record explicit user intent keyed by stable bubble key.
    // This prevents detectAndProcessBubbles() from overriding the user's
    // choice when React re-renders the message DOM during streaming.
    const data = bubbleDataMap.get(bubble.element);
    if (data) {
      const newState = wasCollapsed ? 'expanded' : 'collapsed';
      userExplicitStates.set(data.key, newState);
      log.debug('User toggled %s \u2192 %s', data.key, newState);
    }

    if (CONFIG.persistence !== 'off') {
      const states = CONFIG.persistence === 'perBubble' ? getAllBubbleStates() : null;
      saveConversationState(states);
    }
  }

  // Add toggle control to a bubble
  function addToggleControl(bubble) {
    if (bubbleControlsMap.has(bubble.element)) {
      log.debug('addToggleControl: button already present, skipping');
      return;
    }
    if (!document.contains(bubble.element)) {
      log.debug('addToggleControl: element not in DOM, skipping');
      return;
    }

    const button = document.createElement('button');
    button.className = 'cgcc-toggle-btn';
    button.textContent = 'Collapse';
    button.setAttribute('aria-label', 'Collapse message');
    button.setAttribute('type', 'button');
    button.setAttribute('tabindex', '0');

    if (CONFIG.buttonVisibility === 'hover') {
      button.classList.add('cgcc-toggle-hover');
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleBubble(bubble);
    });
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        toggleBubble(bubble);
      }
    });

    try {
      bubble.element.style.position = 'relative';
      bubble.element.appendChild(button);
      bubbleControlsMap.set(bubble.element, button);
      log.debug('addToggleControl: button added for key=%s', bubbleDataMap.get(bubble.element)?.key);
    } catch (err) {
      log.warn('addToggleControl DOM error', err);
    }
  }

  /**
   * Determine whether a newly-seen bubble should start collapsed.
   * Priority (highest → lowest):
   *   1. Explicit user action this session (userExplicitStates)
   *   2. Persisted per-bubble state from storage
   *   3. Conversation default mode
   */
  function resolveInitialState(bubbleKey, convState) {
    const explicit = userExplicitStates.get(bubbleKey);
    if (explicit !== undefined) {
      log.debug('resolveInitialState %s \u2192 explicit:%s', bubbleKey, explicit);
      return explicit === 'collapsed';
    }
    if (CONFIG.persistence === 'perBubble' && convState && convState.bubbleStates) {
      const saved = convState.bubbleStates[bubbleKey];
      if (saved !== undefined) {
        log.debug('resolveInitialState %s \u2192 persisted:%s', bubbleKey, saved);
        return saved === 'collapsed';
      }
    }
    log.debug('resolveInitialState %s \u2192 default:%s', bubbleKey, currentDefaultMode);
    return currentDefaultMode === 'collapsed';
  }

  // Process all detected bubbles
  async function detectAndProcessBubbles(convState = null) {
    if (processingLock) {
      processingPending = true;
      log.debug('detectAndProcessBubbles: locked \u2014 queuing pending pass');
      return;
    }
    processingLock    = true;
    processingPending = false;

    try {
      if (!convState) {
        convState = await loadConversationState();
      }
      const bubbles = detectBubbles();
      log.debug('detectAndProcessBubbles: %d bubbles to process', bubbles.length);

      for (let i = 0; i < bubbles.length; i++) {
        const bubble = bubbles[i];
        let data = bubbleDataMap.get(bubble.element);
        if (!data) {
          const key = generateBubbleKey(bubble, i);
          data = { key };
          bubbleDataMap.set(bubble.element, data);
          log.debug('New bubble registered key=%s', key);
        }

        const isNew = !bubbleControlsMap.has(bubble.element);
        addToggleControl(bubble);

        if (isNew) {
          const shouldCollapse = resolveInitialState(data.key, convState);
          log.info('Initial state key=%s \u2192 %s', data.key, shouldCollapse ? 'collapsed' : 'expanded');
          if (shouldCollapse) {
            collapseBubble(bubble);
          }
        }
      }
    } finally {
      processingLock = false;
      // If a call was skipped while locked, run one more pass now
      if (processingPending) {
        processingPending = false;
        log.debug('detectAndProcessBubbles: running pending pass');
        setTimeout(() => detectAndProcessBubbles(), 0);
      }
    }
  }

  // Debounced mutation handler
  function handleMutations(mutations) {
    // Only react to node additions; attribute/style mutations don't need reprocessing
    const hasNewNodes = mutations.some(m => m.addedNodes.length > 0);
    if (!hasNewNodes) return;

    clearTimeout(debounceTimer);
    // 200 ms gives streaming content time to settle so we don't see rapidly
    // changing container heights producing duplicate detections mid-stream.
    debounceTimer = setTimeout(() => {
      log.debug('MutationObserver: debounce fired');
      detectAndProcessBubbles();
    }, 200);
  }

  // Setup MutationObserver
  function setupMutationObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    const root = getConversationRoot();
    mutationObserver = new MutationObserver(handleMutations);
    try {
      mutationObserver.observe(root, { childList: true, subtree: true });
      log.debug('MutationObserver attached to <%s>', root.tagName);
    } catch (err) {
      log.error('setupMutationObserver failed', err);
    }
  }

  // Handle commands from background script
  function setupMessageListener() {
    browser.runtime.onMessage.addListener((message) => {
      log.info('Background message: %s', message.type);

      if (message.type === 'COLLAPSE_ALL') {
        currentDefaultMode = 'collapsed';
        detectBubbles().forEach((b) => {
          collapseBubble(b);
          const d = bubbleDataMap.get(b.element);
          if (d) userExplicitStates.set(d.key, 'collapsed');
        });
      } else if (message.type === 'EXPAND_ALL') {
        currentDefaultMode = 'expanded';
        detectBubbles().forEach((b) => {
          expandBubble(b);
          const d = bubbleDataMap.get(b.element);
          if (d) userExplicitStates.set(d.key, 'expanded');
        });
      }

      if (CONFIG.persistence !== 'off') {
        const states = CONFIG.persistence === 'perBubble' ? getAllBubbleStates() : null;
        saveConversationState(states);
      }
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
