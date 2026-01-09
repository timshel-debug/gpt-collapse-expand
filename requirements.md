Below is a comprehensive requirements specification for a Firefox extension that collapses/expands ChatGPT conversation “bubbles” (both user and assistant), with per-bubble controls and right-click context menu actions.

---

## 1. Purpose and Scope

### 1.1 Purpose

Provide an in-page navigation aid for long ChatGPT conversations by enabling:

* Collapse/expand of individual message bubbles.
* Collapse all / expand all actions from the right-click (context) menu.
* A collapsed state that reduces each bubble’s height while still showing approximately 4–5 lines of content.
* Restoring full height and normal layout when expanded.

### 1.2 In Scope

* Firefox extension (Manifest V3).
* Operation on chat.openai.com (and optionally other OpenAI ChatGPT domains if configured).
* User messages and assistant responses.
* Manual actions: per-bubble collapse/expand; global collapse all/expand all.
* Persistence of collapse state per conversation and/or per bubble (configurable).

### 1.3 Out of Scope

* Any server-side changes to ChatGPT.
* Editing or reformatting message content.
* Summarization, extraction, export, or indexing.
* Cross-browser support (Chrome/Edge) unless explicitly added later.

---

## 2. Definitions

* **Bubble / Message bubble**: A single message container representing either the user or assistant content in the ChatGPT UI.
* **Collapsed**: Bubble height constrained such that ~4–5 lines of text remain visible, with overflow hidden.
* **Expanded**: Bubble displayed in its full natural size with no height constraint.
* **Conversation**: A single ChatGPT chat thread (unique URL or conversation identifier).

---

## 3. User Stories

### 3.1 Core user stories

1. As a user, I want to collapse a single message bubble so I can reduce visual clutter while retaining context.
2. As a user, I want to expand a single collapsed bubble to read it fully.
3. As a user, I want to right-click anywhere on the page and select “Collapse all” to quickly reduce the entire thread.
4. As a user, I want to right-click anywhere on the page and select “Expand all” to restore the full thread.
5. As a user, I want collapsing to apply to both my messages and assistant responses.

### 3.2 Persistence and navigation

6. As a user, I want collapsed/expanded states to persist when I reload the page (optional but strongly recommended).
7. As a user, I want the extension to handle dynamic loading as I scroll (ChatGPT loads content progressively).

---

## 4. Functional Requirements

### 4.1 Page activation and permissions

**FR-001** The extension shall activate only on configured domains (default: chat.openai.com).

* Configuration may include optional additional domains (e.g., specific OpenAI regional domains) via extension settings.

**FR-002** The extension shall run without requiring user interaction beyond initial install (i.e., automatic content script injection on supported pages).

### 4.2 Bubble detection and targeting

**FR-010** The extension shall detect message bubbles for:

* User messages.
* Assistant messages.
* System/metadata elements should be ignored unless explicitly recognized as message bubbles.

**FR-011** The extension shall tolerate minor DOM changes by using resilient selectors and heuristics (see Section 9).

* Must not break the page if selectors fail.
* Must fail safely (no action, no UI corruption).

**FR-012** The extension shall update its internal list of bubbles when the DOM changes (e.g., new message arrives, user scroll loads older messages).

* Use MutationObserver with rate limiting/debouncing.

### 4.3 Per-bubble collapse and expand

**FR-020** The extension shall support collapsing an individual bubble.

* Collapsing applies a height constraint and hides overflow.
* Collapsed state preserves readability: show approximately 4–5 lines of text.

**FR-021** The extension shall support expanding an individual bubble.

* Expanded state restores natural layout and height.

**FR-022** The extension shall provide a per-bubble control to toggle collapse/expand.

* Control must be visible on hover or always visible (configurable; default: visible on hover to reduce UI noise).
* Control must be usable with mouse and keyboard (see Accessibility).

**FR-023** The per-bubble control shall be placed in a consistent location within each bubble container.

* Must not overlap primary UI controls (e.g., copy buttons) if present.
* Must not interfere with text selection and scrolling.

### 4.4 Collapse all / expand all (context menu)

**FR-030** The extension shall add two context menu items when right-clicking on the ChatGPT page:

* “Collapse all”
* “Expand all”

**FR-031** Selecting “Collapse all” shall collapse all detected message bubbles in the conversation.

**FR-032** Selecting “Expand all” shall expand all detected message bubbles in the conversation.

**FR-033** Context menu actions shall operate correctly even if only a subset of the conversation is currently rendered.

* Requirement baseline: act on all currently detected bubbles.
* Enhanced behavior (recommended): if feasible, apply state to newly loaded bubbles as they appear (see FR-041).

### 4.5 Visual behavior and layout constraints

**FR-040** Collapsed bubbles shall display approximately 4–5 lines of content.

* Implementation shall prefer line-based clamping where possible (CSS line-clamp or computed max-height).
* If line-clamp cannot be applied reliably due to content structures, the extension shall apply a max-height computed from the bubble’s effective line-height multiplied by a configurable number of lines.

**FR-041** If “Collapse all” is active, newly inserted bubbles (e.g., new assistant response) shall default to collapsed in that conversation until the user expands all or toggles individually.

**FR-042** Collapsed bubbles shall include a subtle visual affordance indicating truncated content.

* Example: fade gradient at bottom, or an “Expand” icon/label.
* Must not obscure readable text.

**FR-043** Expanded bubbles shall have no truncation indicators.

### 4.6 State management and persistence

**FR-050** The extension shall track collapse state:

* Per bubble (recommended, best UX).
* Per conversation default mode (collapsed-all or expanded-all).

**FR-051** The extension shall persist state across reloads using browser storage.

* Storage keying should support:

  * Conversation identifier (preferred) derived from URL path or page metadata.
  * Bubble identifiers (best effort; see Section 9 for DOM resilience).

**FR-052** If the extension cannot reliably identify individual bubbles across reloads, it shall fall back to:

* Persisting only a conversation-level default mode (collapsed-all vs expanded-all), and
* Applying it to all bubbles on load.

### 4.7 Settings (minimum viable vs recommended)

**FR-060 (Recommended)** The extension shall provide an options page allowing users to configure:

* Number of visible lines in collapsed mode (default 5; allowed 3–10).
* Whether per-bubble toggle button is always visible vs hover-only.
* Default mode on new conversations: Expanded or Collapsed.
* Whether collapse state persists per conversation.

**FR-061 (Optional)** Keyboard shortcuts:

* Collapse all (e.g., Ctrl+Shift+C)
* Expand all (e.g., Ctrl+Shift+E)
* Toggle bubble under cursor / focused bubble

---

## 5. Non-Functional Requirements

### 5.1 Performance

**NFR-001** DOM scanning and MutationObserver handling shall be efficient and not noticeably degrade page performance on long threads.

* Must debounce mutation processing.
* Must avoid repeated full-tree queries when incremental changes can be processed.

**NFR-002** “Collapse all” and “Expand all” must complete within acceptable interactive latency:

* Target: <200ms for ~100 bubbles on a modern desktop; degrade gracefully for larger threads.

### 5.2 Reliability and forward compatibility

**NFR-010** Extension shall be robust to moderate ChatGPT DOM changes by:

* Using layered selectors and heuristics.
* Detecting failure conditions and disabling itself rather than breaking layout.

### 5.3 Security and privacy

**NFR-020** Extension shall not transmit content off-device.
**NFR-021** Extension shall not store message content; only store minimal state (IDs and booleans).
**NFR-022** Permissions shall be minimal:

* host permissions only for configured domains
* storage permission
* contextMenus permission

### 5.4 Accessibility

**NFR-030** Per-bubble toggle control must be accessible:

* Focusable element.
* ARIA label: “Collapse message” / “Expand message”.
* Visible focus indicator.
* Keyboard activation via Enter/Space.

---

## 6. UX and Interaction Design

### 6.1 Per-bubble toggle control

* Appears near top-right of bubble (or consistent corner).
* States:

  * Expanded: control shows “Collapse” (icon optional).
  * Collapsed: control shows “Expand”.
* Hover-only behavior must not prevent keyboard users from accessing it (must still appear when bubble is focused).

### 6.2 Collapsed visual design

* Bubble height reduces to show ~4–5 lines.
* Overflow hidden.
* Optional bottom fade to indicate truncation.
* Ensure code blocks and lists behave acceptably:

  * If a code block is the first content, clamping should still work without exploding layout.

### 6.3 Context menu

* Menu items only appear on supported pages.
* Items remain stable in label and ordering.

---

## 7. Edge Cases and Special Handling

### 7.1 Streaming responses

* While the assistant is streaming a response, if conversation default is “collapsed-all,” the bubble should remain collapsed as it grows.
* If the user expands that bubble mid-stream, it should remain expanded until explicitly collapsed.

### 7.2 Very short messages

* If a bubble is shorter than the collapsed threshold, collapsing should still apply logically but produce minimal/no visual change.
* Toggle state should remain consistent.

### 7.3 Code blocks, tables, and long lists

* Collapsed state must not cause horizontal layout breakage.
* Must not overlay scrollbars or copy buttons.
* If the message contains preformatted blocks, collapsing should clip vertically only.

### 7.4 Conversation switches

* Navigating between conversations (SPA behavior) must reinitialize state detection and application.
* Must detect URL changes and re-run initialization.

---

## 8. Acceptance Criteria (Testable)

### 8.1 Individual bubble toggling

* Given an expanded bubble, when the user clicks the toggle, then the bubble becomes collapsed and shows approximately 4–5 lines of text.
* Given a collapsed bubble, when the user clicks the toggle, then the bubble returns to full height.

### 8.2 Context menu actions

* When the user right-clicks anywhere on a ChatGPT conversation page, then context menu contains “Collapse all” and “Expand all”.
* When the user selects “Collapse all”, then all visible bubbles become collapsed.
* When the user selects “Expand all”, then all visible bubbles become expanded.

### 8.3 Persistence

* When the user collapses multiple bubbles, reloads the page, then the same bubbles (or at minimum the conversation default) remain collapsed.
* When the user switches to a different conversation, the previous conversation’s state does not incorrectly leak (unless configured to apply globally).

### 8.4 Dynamic content

* When a new assistant response is added after “Collapse all”, the new response bubble appears collapsed by default.
* When “Expand all” is applied, subsequent new bubbles appear expanded by default.

### 8.5 Safety

* If the extension cannot detect bubbles due to DOM changes, it does not break page layout and does not throw repeating errors.

---

## 9. Implementation Notes and DOM Strategy Requirements

These are requirements on approach, not code-level instructions.

### 9.1 Bubble identification strategy

**IR-001** The extension shall identify bubbles using a layered approach:

1. Preferred: stable attributes or roles in the message container (if present).
2. Fallback: structural heuristics (e.g., containers that include author role markers or message grouping patterns).
3. Fallback: nearest ancestor container around message content blocks.

**IR-002** The extension shall assign an internal ID to each detected bubble.

* Prefer deterministic IDs if the page provides them.
* Otherwise, derive a best-effort ID:

  * conversationId + bubbleIndexAmongSiblings + hash of a small stable signature (not full content).
* Must not store full message text.

### 9.2 Applying collapse without breaking layout

**IR-010** The extension shall apply collapse styles in a way that:

* Does not remove content from DOM.
* Does not interfere with text copy, selection (outside collapsed region), or built-in controls.

**IR-011** Styles should be applied via:

* Adding/removing a CSS class on the bubble container, and
* Injecting a stylesheet once per page.

### 9.3 SPA navigation handling

**IR-020** The extension shall detect route changes within the SPA:

* Observe URL changes (history API hooks) or polling.
* Re-run detection and apply persisted state.

---

## 10. Configuration and Defaults

### 10.1 Defaults

* Collapsed visible lines: 5
* Default mode on conversation load: Expanded
* Per-bubble toggle control: visible on hover (but keyboard-accessible)
* Persist state: enabled
* Apply collapse-all default to new bubbles: enabled

---

## 11. Telemetry and Logging

**TR-001** Extension shall not collect telemetry by default.
**TR-002 (Optional)** Provide a local debug logging toggle in options; logs remain local in console.

---

## 12. Packaging and Deployment Requirements

**PKG-001** Must be compatible with Firefox Manifest V3.
**PKG-002** Must include:

* `manifest.json`
* Background script/service worker (for context menu integration)
* Content script (DOM manipulation)
* Options page (recommended)

**PKG-003** Must be publishable on Firefox Add-ons with a clear privacy statement:

* No data collection
* No external network calls

---

## 13. Future Enhancements (Non-Blocking)

* “Collapse all above” / “Collapse all below” relative to a selected message.
* Search and jump between expanded-only messages.
* Auto-collapse assistant messages only (user-configurable).
* “Focus mode” that collapses everything except the last N messages.
* Export/import collapse state.

---

## Technical design

### 1) MV3 architecture (Firefox-first, Chromium-tolerant)

**Key constraint:** Firefox’s MV3 implementation has diverged from Chromium’s. Notably, Chrome’s MV3 requires a service-worker background; Firefox has historically supported MV3 while still allowing **DOM-based background scripts / event pages** rather than requiring a service worker. Mozilla explicitly notes this divergence and that Chrome’s required MV3 service worker model is not (or was not) supported the same way in Firefox. ([Mozilla Blog][1])

#### Components

1. **Background script (non-persistent / event page style)**

   * Owns creation of **context menu** items (“Collapse all”, “Expand all”).
   * Handles menu clicks and sends commands to the active ChatGPT tab via `tabs.sendMessage`.
   * Re-creates menus on `runtime.onInstalled` and `runtime.onStartup` to ensure they exist after worker/event lifecycle changes.

2. **Content script**

   * Runs on `chat.openai.com/*` (and other configured domains).
   * Detects ChatGPT message bubbles in the DOM.
   * Injects a small stylesheet once.
   * Adds a per-bubble toggle control (collapse/expand).
   * Applies collapse/expand styles and manages per-conversation/per-bubble state.
   * Observes DOM changes via `MutationObserver` and applies default mode and/or persisted states to newly-added bubbles.

3. **Options page**

   * Allows configuration:

     * Visible lines when collapsed (default 5).
     * Toggle visibility mode (hover vs always).
     * Persistence mode: off / per-conversation default only / per-bubble.
     * Default for new conversations: expanded vs collapsed.
   * Writes settings to `browser.storage.local`.

#### Manifest approach

* Use MV3 `manifest_version: 3`.
* For Firefox background: `background.scripts` remains the most reliable approach (per MDN’s background documentation describing scripts/background pages/service workers in general). ([MDN Web Docs][2])
* If you want cross-browser later, Mozilla notes an extension can specify both worker and scripts and have it work in newer Chrome/Firefox, but implement Firefox-first now. ([Mozilla Blog][1])

---

### 2) DOM strategy (robust bubble detection in a moving target UI)

You are manipulating a third-party SPA whose DOM will change. The design must be **selector-layered** and **fail-safe**.

#### 2.1 Conversation boundary detection

Find a stable “conversation root” container to scope queries and reduce cost:

* Primary: locate `main` and then the scrollable conversation container under it.
* Fallback: use `document.body` (but only if required).

#### 2.2 Bubble identification (layered selectors)

**Goal:** identify each *turn* and classify as user/assistant.

Layer 1 (preferred, low brittleness):

* Find elements with author-role markers, historically seen in ChatGPT UIs:

  * `[data-message-author-role="user"]`
  * `[data-message-author-role="assistant"]`
    Then take the nearest ancestor that represents the full bubble/turn container.

Layer 2 (fallback):

* Find “turn” containers (often a repeated wrapper per message) by looking for repeated structures:

  * `article`, or
  * elements with `data-testid`/role-like markers if present.
    Classify user vs assistant by inspecting a descendant with role/label text or by relative layout (less reliable).

Layer 3 (last resort):

* Identify blocks that contain markdown content plus nearby avatar/author indicator, and treat their outer container as a bubble.

**Fail-safe rule:** If classification is ambiguous, do not inject controls (skip that node), rather than risking UI corruption.

#### 2.3 Bubble “body element” selection

You need a child element to apply truncation without breaking layout or interfering with built-in controls.

Preferred:

* A descendant that contains the rendered message content (often `.markdown` or equivalent).
  Fallback:
* The main content wrapper inside the turn container.

**Do not re-parent large DOM subtrees** if you can avoid it (React/SPAs can be sensitive). Prefer:

* Adding a single absolutely-positioned toggle button.
* Applying a CSS class + inline `style.maxHeight` to the selected body element.

---

### 3) Collapse mechanics (4–5 visible lines, minimal breakage)

**Problem:** CSS `line-clamp` is elegant but often fails on complex markdown that contains multiple block-level nodes (code blocks, lists, tables). Design for pixel-based truncation.

#### 3.1 How to compute collapsed height

On collapse:

1. Compute an effective `lineHeightPx`:

   * Try `getComputedStyle(bodyEl).lineHeight`.
   * If `normal`, derive from font-size: `lineHeight ≈ fontSize * 1.4` (practical fallback).
2. `collapsedLines` from settings (default 5).
3. Compute `maxHeight = lineHeightPx * collapsedLines + paddingAllowance`.

   * padding allowance: ~8–16px to avoid clipping descenders.

Apply:

* `bodyEl.style.maxHeight = "${maxHeight}px"`
* `bodyEl.style.overflow = "hidden"`
* Add class `cgcc-collapsed`

On expand:

* Remove inline max-height/overflow, remove class.

#### 3.2 Visual affordance

When collapsed:

* Add a subtle bottom fade overlay (pure CSS pseudo-element) attached to the bubble container, not the body element, to avoid interfering with selection/copy.

When expanded:

* Remove fade.

#### 3.3 Interaction constraints

* Toggle button must not steal clicks intended for selection.
* Place it top-right within bubble container, `pointer-events: auto` only on button.
* Keyboard accessible (tab-focusable, Enter/Space toggles).

---

### 4) State model and storage schema

Use `browser.storage.local` (MV3-friendly, no server calls).

#### 4.1 Data model

```json
{
  "settings": {
    "collapsedLines": 5,
    "toggleVisibility": "hover",
    "defaultMode": "expanded",
    "persistence": "perBubble",   // "off" | "conversationDefault" | "perBubble"
    "applyDefaultToNewBubbles": true
  },
  "conversations": {
    "<conversationKey>": {
      "defaultMode": "collapsed", // tracks last global state used
      "bubbleStates": {
        "<bubbleKey>": "collapsed" // only if persistence=perBubble
      },
      "updatedAt": 1730000000000
    }
  }
}
```

#### 4.2 Conversation key

Derive from URL:

* Preferred: conversation id embedded in path (e.g., `/c/<id>` style).
* Fallback: full pathname + search (stable enough).

#### 4.3 Bubble key (best-effort, no content storage)

Bubble IDs in a third-party SPA are tricky.

Use a tiered approach:

1. If the bubble/turn has a stable attribute id (e.g., `data-message-id`), use it.
2. Else compute a **signature hash**:

   * authorRole (“user”/“assistant”)
   * bubble index within conversation at time of scan
   * a *very short* text fingerprint:

     * normalized first 32 chars of visible text → hashed (store only hash)
   * Combine and hash again for the key.

This avoids storing actual message text, while providing reasonable matching across reloads.

#### 4.4 Persistence fallback

If keys can’t be made stable, degrade gracefully:

* Store only `defaultMode` for the conversation and apply to all bubbles on load and to newly added bubbles.

---

### 5) Mutation handling (dynamic loading + streaming)

Use `MutationObserver` (the standard approach for DOM change detection in extensions). ([Stack Overflow][3])

#### 5.1 Observer strategy

* Observe the conversation root: `{ childList: true, subtree: true }`
* Collect added nodes, but do not process immediately for each mutation.
* Debounce processing:

  * schedule a single `setTimeout(..., 50)` or `requestAnimationFrame` loop to batch work.
* In batch:

  * detect newly-added bubbles
  * attach toggle controls if missing
  * apply conversation default mode and/or persisted per-bubble state

#### 5.2 SPA navigation (route changes)

ChatGPT is an SPA; URL changes without full reload.

Implement in content script:

* Hook `history.pushState` and `history.replaceState` to dispatch a custom `cgcc:navigation` event.
* Listen to `popstate`.
* On navigation event:

  * clear internal caches
  * re-detect conversation root
  * load conversation state
  * rescan and apply

Fail-safe:

* Also run a lightweight URL poll every ~500–1000ms as a fallback if hooks fail.

---

### 6) Message passing and command protocol

#### Commands from background → content

```ts
type Command =
  | { type: "COLLAPSE_ALL" }
  | { type: "EXPAND_ALL" }
  | { type: "TOGGLE_BUBBLE"; bubbleKey?: string }; // bubbleKey optional; primarily internal
```

* `COLLAPSE_ALL` sets conversation default = collapsed and collapses all detected bubbles.
* `EXPAND_ALL` sets conversation default = expanded and expands all detected bubbles.
* Content script updates storage after applying.

---

### 7) Context menu integration (background)

Use `browser.menus` / `contextMenus` API:

* Create two items on install/startup.
* On click:

  * verify active tab is ChatGPT domain
  * send message to content script

(See MDN background and menus docs for API structure; background usage is documented by MDN. ([MDN Web Docs][2]))

---

### 8) Proposed repository layout

```
chatgpt-collapse/
  manifest.json
  background.js
  content-script.js
  content-styles.css
  options.html
  options.js
  icons/
    icon-48.png
    icon-96.png
  README.md
  PRIVACY.md
```

---

## Implementation prompts (tightly constrained, minimal rework)

Below are prompts you can feed to an LLM to generate the extension in a controlled way. They are structured as an incremental build with explicit file outputs and acceptance checks.

### Prompt 1 — Scaffold + manifest + permissions

**Recommended model:** claude-sonnet (strong at multi-file scaffolds, careful with requirements and edge cases).

```text
You are implementing a Firefox WebExtension using Manifest V3.

Goal: Create the full initial project scaffold for a Firefox-first extension that collapses/expands ChatGPT message bubbles on chat.openai.com.

Hard constraints:
- Firefox MV3: use background scripts (NOT service_worker) in manifest.json.
- Minimal permissions: "storage", "tabs", "menus" (or "contextMenus" if you choose; explain choice in a comment), plus host_permissions for chat.openai.com only.
- Provide these files with exact paths and complete contents:
  - manifest.json
  - background.js (empty stub with TODOs is fine)
  - content-script.js (empty stub with TODOs is fine)
  - content-styles.css (empty stub with TODOs is fine)
  - options.html (minimal shell)
  - options.js (minimal shell)
  - README.md (how to load as temporary add-on and basic manual test steps)
  - PRIVACY.md (explicitly state no network calls, no content storage)

Manifest requirements:
- content_scripts runs at document_idle on https://chat.openai.com/*.
- background uses scripts: ["background.js"] and is non-persistent (MV3 semantics).
- options_ui must point to options.html.
- icons: include placeholders icon-48.png and icon-96.png (do NOT generate binary; just reference them).

Output format:
- First, a short file list.
- Then each file in its own fenced code block labeled with the file path.
Do not include any other commentary outside the file list and the file contents.
```

---

### Prompt 2 — Background script: context menu + message dispatch

**Recommended model:** claude-sonnet (correct API usage + lifecycle handling).

```text
Update background.js ONLY. Implement context menu integration for Firefox MV3.

Requirements:
- Create two menu items on runtime.onInstalled and runtime.onStartup:
  - id: "cgcc-collapse-all", title: "Collapse all"
  - id: "cgcc-expand-all", title: "Expand all"
- Ensure menus are not duplicated across restarts:
  - Call browser.menus.removeAll() before creating, OR handle errors idempotently.
- On menus.onClicked:
  - Find the active tab in the current window.
  - Only act if tab.url starts with "https://chat.openai.com/".
  - Send a message to the tab via browser.tabs.sendMessage:
    - { type: "COLLAPSE_ALL" } or { type: "EXPAND_ALL" }
- Handle errors gracefully:
  - If sendMessage fails because content script isn’t ready, log a single warning and do nothing else (no retries, no spam).
- No external dependencies.

Output:
- Provide the full updated background.js file contents only.
```

---

### Prompt 3 — Content script core: detection, collapse/expand all, CSS injection

**Recommended model:** claude-opus (best for careful DOM heuristics + robust debounced MutationObserver). If you want cheaper, claude-sonnet is acceptable.

```text
Implement content-script.js and content-styles.css.

Primary goal:
- Detect ChatGPT message bubbles (user + assistant) robustly.
- Support receiving commands from background: COLLAPSE_ALL and EXPAND_ALL.
- Add per-bubble toggle buttons to collapse/expand individually.
- When collapsed, show ~5 lines (configurable later, but hardcode default 5 for now).
- When expanded, restore natural size.

DOM strategy constraints:
- Prefer selecting bubbles using [data-message-author-role="user"] and [data-message-author-role="assistant"] if present.
- If not present, do NOT attempt risky heuristics: fail-safe by doing nothing (but keep listening for mutations).
- For each role element found, choose a bubble container ancestor with a stable boundary (document your chosen ancestor logic in code comments).
- Select a "body element" within the bubble to clamp. Prefer a markdown/content descendant; otherwise clamp the bubble container itself.

Collapse mechanics:
- Pixel-based maxHeight derived from computed line-height of the body element:
  - collapsedLines = 5
  - If line-height is "normal", estimate = fontSize * 1.4
  - maxHeight = lineHeight * collapsedLines + 12
- Apply overflow hidden.
- Add a bottom fade affordance via CSS class on the bubble container.

Per-bubble toggle:
- A button placed top-right of the bubble container (position absolute).
- Text: "Collapse" when expanded, "Expand" when collapsed.
- Keyboard accessible: button must be focusable and toggles on click, Enter, Space.
- Must not break existing page controls: keep button small and avoid overlap as much as possible.

Mutation handling:
- Use MutationObserver on a reasonable conversation root (main preferred).
- Debounce processing: batch changes at least every 50ms.
- On new bubbles: add toggle button + apply current conversation default mode (see below).

Conversation default mode:
- Maintain an in-memory variable currentDefaultMode = "expanded" initially.
- When COLLAPSE_ALL: set currentDefaultMode="collapsed" and collapse all detected bubbles.
- When EXPAND_ALL: set currentDefaultMode="expanded" and expand all detected bubbles.
- Newly added bubbles adopt currentDefaultMode.

CSS injection:
- content-styles.css must define classes for collapsed state and fade.
- Ensure styles are scoped to avoid affecting non-ChatGPT pages (prefix classes with cgcc-).

No storage yet in this prompt.

Output format:
- Provide updated content-script.js and content-styles.css only, each in its own fenced code block labeled with file path.
```

---

### Prompt 4 — Persistence: storage schema + conversation keys + bubble keys

**Recommended model:** claude-sonnet (good balance of correctness and pragmatism).

```text
Update content-script.js ONLY to add persistence using browser.storage.local.

Implement this schema in storage.local:
- settings (object):
  - collapsedLines (number, default 5)
  - persistence (string enum: "off" | "conversationDefault" | "perBubble", default "perBubble")
  - defaultMode (string enum: "expanded" | "collapsed", default "expanded")
- conversations (object map):
  - key = conversationKey
  - value:
    - defaultMode ("expanded" | "collapsed")
    - bubbleStates (map bubbleKey -> "expanded" | "collapsed") [only if perBubble]
    - updatedAt (ms epoch)

Conversation key rules:
- If location.pathname contains "/c/" then use the path segment after "/c/" as conversation id.
- Else use location.pathname as conversationKey.

Bubble key rules:
- If bubble container has attribute data-message-id use it.
- Else compute a stable-ish hash key:
  - role ("user"/"assistant")
  - index within current scan
  - short fingerprint hash of the first 32 visible characters of the bubble text (store only the hash, not the text)
Provide a tiny deterministic hash function in JS (e.g., FNV-1a 32-bit) implemented inline.

Behavior:
- On initialization and on SPA navigation (if you already implemented), load settings and conversation state.
- Set currentDefaultMode from persisted conversation defaultMode if present, else from settings.defaultMode.
- Apply persisted per-bubble states if persistence="perBubble"; else apply currentDefaultMode to all.
- When user toggles a bubble: update bubbleStates and updatedAt.
- When COLLAPSE_ALL / EXPAND_ALL: update conversation defaultMode and updatedAt; if persistence is perBubble, also update bubbleStates for all detected bubbles to match.
- Do not store any full message text.

Output:
- Provide the full updated content-script.js only.
```

---

### Prompt 5 — Options UI wired to settings

**Recommended model:** gpt-5 mini (small, contained UI wiring; low risk and fast).

```text
Implement options.html and options.js to manage extension settings in browser.storage.local.

Requirements:
- options.html:
  - A simple form with:
    - Collapsed lines: number input (min 3, max 10), default 5
    - Persistence: select with options Off / Conversation default / Per-bubble
    - Default mode: select Expanded / Collapsed
  - A "Save" button
  - A small status text area (e.g., "Saved")
- options.js:
  - On load: read settings from storage.local, populate the form (use defaults if missing)
  - On save: validate ranges, then write settings back to storage.local under "settings"
  - Show "Saved" for 1–2 seconds after successful write
- No frameworks, no external deps, no fancy styling.

Output:
- Provide updated options.html and options.js only, each in its own fenced code block labeled with file path.
```

---

### Prompt 6 — Hardening pass: SPA navigation + defensive guards + manual test checklist

**Recommended model:** claude-sonnet (good at cross-cutting concerns and defensive coding).

```text
Hardening pass. Update ONLY content-script.js and README.md.

Add:
1) SPA navigation detection:
- Hook history.pushState and history.replaceState to dispatch a custom event, and listen to popstate.
- On navigation, re-run initialization: recompute conversationKey, reload state, rescan bubbles, apply.
- Also implement a lightweight URL poll fallback every 1000ms.

2) Defensive guards:
- Ensure toggle buttons aren’t duplicated if observer sees the same bubble multiple times.
- Ensure you do not throw if elements disappear mid-operation.
- Ensure MutationObserver processing is debounced and does not loop infinitely.

3) README manual test checklist:
- Install temporary add-on steps.
- Test: per-bubble collapse/expand, collapse all/expand all via context menu, persistence across reload, new bubble inherits default, conversation navigation retains separation.

Output format:
- Provide updated content-script.js and README.md only, each in its own fenced code block labeled with file path.
```

---

## Practical note on “minimal rework”

If you follow the prompts in order, you avoid the usual extension failure modes:

* background menus not created reliably in MV3 lifecycle
* bubble detection breaking the page
* uncontrolled MutationObserver churn
* persistence corrupting due to unstable IDs



[1]: https://blog.mozilla.org/addons/2024/03/13/manifest-v3-manifest-v2-march-2024-update/?utm_source=chatgpt.com "Manifest V3 & Manifest V2 (March 2024 update) - Mozilla Add ..."
[2]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background?utm_source=chatgpt.com "background - MDN Web Docs - Mozilla"
[3]: https://stackoverflow.com/questions/8882502/how-to-track-dom-change-in-chrome-extension?utm_source=chatgpt.com "How to track DOM change in chrome extension?"
