<!-- Copilot / AI agent instructions for working on this extension -->
# AI assistant guide — ChatGPT Bubble Collapse

Purpose: help code-writing agents become productive quickly in this repository.

1) Big picture
- This is a Firefox MV3 extension that injects a **content script** into ChatGPT pages to add per-message collapse/expand controls. The extension surface is small:
  - `manifest.json` — MV3 manifest (background script + content script + options UI)
  - `background.js` — context menu creation and message relay to content script
  - `content-script.js` — core logic: DOM detection, toggle controls, persistence, MutationObserver
  - `content-styles.css` — visual styles for toggles and collapsed state
  - `options.html` / `options.js` — settings UI and storage management

2) Key flows & integration points
- Background -> Content: `background.js` sends messages (`{type: "COLLAPSE_ALL"}` / `"EXPAND_ALL"`) via `browser.tabs.sendMessage` to the page. See menu IDs `cgcc-collapse-all` and `cgcc-expand-all`.
- Content script responsibilities: detect bubbles (`detectBubbles()`), create toggle controls (`addToggleControl()`), compute collapse heights (`computeCollapsedHeight()`), and persist state to `browser.storage.local` under keys `settings` and `conversations`.
- SPA navigation: `content-script.js` hooks `history.pushState`/`replaceState` and polls URL changes as a fallback.

3) Project-specific conventions
- Defensive coding: many DOM ops wrapped in try/catch; avoid throwing to the page. Follow the same pattern for new changes.
- Detection-first approach: prefer resilient selectors (e.g. `[data-message-author-role]`) and avoid aggressive heuristics. If adding selectors, keep them layered and opt-in to prevent false positives.
- Persistence schema: `browser.storage.local` keys:
  - `settings` — object matching `options.js` defaults (`collapsedLines`, `persistence`, `defaultMode`)
  - `conversations` — map of conversationKey -> { defaultMode, bubbleStates?, updatedAt }

4) Developer workflows (how to run/test)
- Load temporary add-on in Firefox: open `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on..." → pick `manifest.json`.
- Manual test checklist lives in [README.md](README.md) — use it for regression verification.
- To debug content-script in page: load extension, open `https://chat.openai.com/`, open devtools for that tab (Console/Inspector) — content script logs use `[CGCC]` prefix.

5) Common change patterns and examples
- To adjust DOM detection: edit `detectBubbles()` in `content-script.js`. Keep the function layered: prefer `data-message-author-role`, then fallback heuristics. Example: modify the ancestor heuristic that searches for `.group`.
- To change collapse sizing: edit `computeCollapsedHeight(bodyEl)` — it computes line-height and applies padding allowance.
- To change persistence behavior: update `options.js` defaults and the `saveConversationState()` / `loadConversationState()` logic in `content-script.js`.

6) Tests and safety
- There are no automated tests. Use the manual checklist in [README.md](README.md).
- Keep changes small and run the manual checklist steps after edits that affect DOM selectors, MutationObserver behavior, or storage schema.

7) Helpful code pointers (where to look)
- Bubble detection and keys: `content-script.js` — `detectBubbles()`, `generateBubbleKey()`, `fnv1aHash()`.
- Toggle UI and keyboard support: `addToggleControl()` and event handlers in `content-script.js`.
- Context-menu integration: `background.js` (menu IDs and `browser.menus.onClicked`).
- Settings UI: `options.js` (`DEFAULT_SETTINGS`) and `options.html`.

If any parts of the app rely on non-obvious external behavior (site markup drift or runtime differences), tell me which pages or scenarios to test and I'll update or expand these instructions.

-- End of agent guide
