// Content script for ChatGPT Bubble Collapse extension
// Handles DOM detection, bubble manipulation, and state management

window.__CGCC_LOADED__ = true;
console.log("[CGCC] content script loaded", location.href);

(function() {
  'use strict';

  // Configuration (will be loaded from storage)
  const CONFIG = {
    collapsedLines: 5,
    buttonVisibility: 'hover', // 'hover' or 'always'
    persistence: 'perBubble', // 'off' | 'conversationDefault' | 'perBubble'
    defaultMode: 'expanded' // 'expanded' | 'collapsed'
  };

  // State
  let currentDefaultMode = 'expanded'; // 'expanded' or 'collapsed'
  const bubbleControlsMap = new WeakMap(); // Maps bubble element to its control button
  const bubbleDataMap = new WeakMap(); // Maps bubble element to its data (key, etc.)
  let mutationObserver = null;
  let debounceTimer = null;
  let conversationKey = null;
  let lastUrl = window.location.href;
  let urlCheckInterval = null;

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
    // Try to use data-message-id if available
    const messageId = bubble.element.getAttribute('data-message-id');
    if (messageId) {
      return messageId;
    }

    // Otherwise, generate a stable-ish key
    const role = bubble.role;
    
    // Get short text fingerprint (first 32 chars)
    const bodyEl = getBubbleBody(bubble);
    const text = bodyEl.textContent.trim().substring(0, 32);
    const textHash = fnv1aHash(text);

    // Combine role, index, and text hash
    return `${role}-${index}-${textHash}`;
  }

  // Load settings from storage
  async function loadSettings() {
    try {
      const result = await browser.storage.local.get('settings');
      if (result.settings) {
        Object.assign(CONFIG, result.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Load conversation state from storage
  async function loadConversationState() {
    conversationKey = getConversationKey();
    
    try {
      const result = await browser.storage.local.get('conversations');
      const conversations = result.conversations || {};
      const convState = conversations[conversationKey];

      if (convState) {
        currentDefaultMode = convState.defaultMode || CONFIG.defaultMode;
        return convState;
      }
    } catch (error) {
      console.error('Error loading conversation state:', error);
    }

    currentDefaultMode = CONFIG.defaultMode;
    return null;
  }

  // Save conversation state to storage
  async function saveConversationState(bubbleStates = null) {
    try {
      const result = await browser.storage.local.get('conversations');
      const conversations = result.conversations || {};

      const convState = {
        defaultMode: currentDefaultMode,
        updatedAt: Date.now()
      };

      if (CONFIG.persistence === 'perBubble' && bubbleStates) {
        convState.bubbleStates = bubbleStates;
      }

      conversations[conversationKey] = convState;
      await browser.storage.local.set({ conversations });
    } catch (error) {
      console.error('Error saving conversation state:', error);
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
    const convState = await loadConversationState();
    
    injectStyles();
    await detectAndProcessBubbles(convState);
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

  // Handle navigation (conversation switch)
  async function handleNavigation() {
    // Clear state
    bubbleControlsMap = new WeakMap();
    bubbleDataMap = new WeakMap();

    // Reload conversation state
    const convState = await loadConversationState();

    // Reprocess bubbles
    await detectAndProcessBubbles(convState);
  }

  // Inject CSS if not already injected
  function injectStyles() {
    // CSS is injected via manifest, but we can add dynamic styles if needed
  }

  // Detect conversation root
  function getConversationRoot() {
    // Prefer main element
    const main = document.querySelector('main');
    if (main) return main;
    // Fallback to body
    return document.body;
  }

  // Detect all message bubbles
  function detectBubbles() {
    const root = getConversationRoot();
    const bubbles = [];

    // Strategy 1: Look for data-message-author-role attributes (preferred)
    const roleElements = root.querySelectorAll('[data-message-author-role]');
    
    for (const roleEl of roleElements) {
      const role = roleEl.getAttribute('data-message-author-role');
      if (role === 'user' || role === 'assistant') {
        // Find the bubble container - we want a stable ancestor
        // The roleEl itself or a close ancestor is typically the bubble container
        let bubbleContainer = roleEl;
        
        // If roleEl is very small, look for a larger ancestor
        // Heuristic: find the ancestor that contains the full message content
        while (bubbleContainer.parentElement && 
               bubbleContainer.parentElement !== root &&
               !bubbleContainer.classList.contains('group') && // Common ChatGPT class
               bubbleContainer.offsetHeight < 50) {
          bubbleContainer = bubbleContainer.parentElement;
        }

        bubbles.push({
          element: bubbleContainer,
          role: role,
          roleElement: roleEl
        });
      }
    }

    // If no bubbles found with preferred method, fail-safe: do nothing
    // We won't attempt risky heuristics
    
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

      const maxHeight = computeCollapsedHeight(bodyEl);

      bodyEl.style.maxHeight = `${maxHeight}px`;
      bodyEl.style.overflow = 'hidden';
      bubble.element.classList.add('cgcc-collapsed');

      // Update button text
      const button = bubbleControlsMap.get(bubble.element);
      if (button) {
        button.textContent = 'Expand';
        button.setAttribute('aria-label', 'Expand message');
      }
    } catch (error) {
      // Defensive: fail silently
      console.warn('Failed to collapse bubble:', error);
    }
  }

  // Expand a bubble
  function expandBubble(bubble) {
    try {
      const bodyEl = getBubbleBody(bubble);
      if (!bodyEl || !document.contains(bodyEl)) return;
      
      bodyEl.style.maxHeight = '';
      bodyEl.style.overflow = '';
      bubble.element.classList.remove('cgcc-collapsed');

      // Update button text
      const button = bubbleControlsMap.get(bubble.element);
      if (button) {
        button.textContent = 'Collapse';
        button.setAttribute('aria-label', 'Collapse message');
      }
    } catch (error) {
      // Defensive: fail silently
      console.warn('Failed to expand bubble:', error);
    }
  }

  // Check if a bubble is collapsed
  function isBubbleCollapsed(bubble) {
    return bubble.element.classList.contains('cgcc-collapsed');
  }

  // Toggle a bubble's collapse state
  function toggleBubble(bubble) {
    if (isBubbleCollapsed(bubble)) {
      expandBubble(bubble);
    } else {
      collapseBubble(bubble);
    }

    // Save state if persistence is enabled
    if (CONFIG.persistence !== 'off') {
      const bubbleStates = CONFIG.persistence === 'perBubble' ? getAllBubbleStates() : null;
      saveConversationState(bubbleStates);
    }
  }

  // Add toggle control to a bubble
  function addToggleControl(bubble) {
    // Check if control already exists (defensive: prevent duplicates)
    if (bubbleControlsMap.has(bubble.element)) {
      return;
    }

    // Defensive: ensure element is still in DOM
    if (!document.contains(bubble.element)) {
      return;
    }

    // Create button
    const button = document.createElement('button');
    button.className = 'cgcc-toggle-btn';
    button.textContent = 'Collapse';
    button.setAttribute('aria-label', 'Collapse message');
    button.setAttribute('type', 'button');
    button.setAttribute('tabindex', '0');

    // Apply visibility mode
    if (CONFIG.buttonVisibility === 'hover') {
      button.classList.add('cgcc-toggle-hover');
    }

    // Event listeners
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

    // Add to bubble
    try {
      bubble.element.style.position = 'relative';
      bubble.element.appendChild(button);

      // Store in map
      bubbleControlsMap.set(bubble.element, button);
    } catch (error) {
      // Defensive: fail silently if DOM operation fails
      console.warn('Failed to add toggle control:', error);
    }
  }

  // Process all detected bubbles
  async function detectAndProcessBubbles(convState = null) {
    const bubbles = detectBubbles();

    // Load conversation state if not provided
    if (!convState) {
      convState = await loadConversationState();
    }

    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      
      // Generate and store bubble key
      const bubbleKey = generateBubbleKey(bubble, i);
      let bubbleData = bubbleDataMap.get(bubble.element);
      if (!bubbleData) {
        bubbleData = { key: bubbleKey };
        bubbleDataMap.set(bubble.element, bubbleData);
      }

      // Add toggle control if not present
      const isNewBubble = !bubbleControlsMap.has(bubble.element);
      addToggleControl(bubble);

      // Apply state to new bubbles
      if (isNewBubble) {
        let shouldCollapse = false;

        if (CONFIG.persistence === 'perBubble' && convState && convState.bubbleStates) {
          // Use per-bubble state
          const savedState = convState.bubbleStates[bubbleKey];
          if (savedState === 'collapsed') {
            shouldCollapse = true;
          } else if (savedState === 'expanded') {
            shouldCollapse = false;
          } else {
            // No saved state for this bubble, use default
            shouldCollapse = currentDefaultMode === 'collapsed';
          }
        } else {
          // Use conversation default mode
          shouldCollapse = currentDefaultMode === 'collapsed';
        }

        if (shouldCollapse) {
          collapseBubble(bubble);
        }
      }
    }
  }

  // Debounced mutation handler
  function handleMutations() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      detectAndProcessBubbles();
    }, 50);
  }

  // Setup MutationObserver
  function setupMutationObserver() {
    const root = getConversationRoot();

    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver((mutations) => {
      // Defensive: limit processing to prevent infinite loops
      if (mutations.length > 1000) {
        console.warn('Too many mutations, skipping batch');
        return;
      }

      // Check if there are new nodes
      let hasNewNodes = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }

      if (hasNewNodes) {
        handleMutations();
      }
    });

    try {
      mutationObserver.observe(root, {
        childList: true,
        subtree: true
      });
    } catch (error) {
      console.error('Failed to setup MutationObserver:', error);
    }
  }

  // Handle commands from background script
  function setupMessageListener() {
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'COLLAPSE_ALL') {
        currentDefaultMode = 'collapsed';
        const bubbles = detectBubbles();
        for (const bubble of bubbles) {
          collapseBubble(bubble);
        }
        
        // Save state
        if (CONFIG.persistence !== 'off') {
          const bubbleStates = CONFIG.persistence === 'perBubble' ? getAllBubbleStates() : null;
          saveConversationState(bubbleStates);
        }
      } else if (message.type === 'EXPAND_ALL') {
        currentDefaultMode = 'expanded';
        const bubbles = detectBubbles();
        for (const bubble of bubbles) {
          expandBubble(bubble);
        }
        
        // Save state
        if (CONFIG.persistence !== 'off') {
          const bubbleStates = CONFIG.persistence === 'perBubble' ? getAllBubbleStates() : null;
          saveConversationState(bubbleStates);
        }
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
