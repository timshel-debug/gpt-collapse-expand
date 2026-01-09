# ChatGPT Bubble Collapse

A Firefox extension that allows collapsing and expanding ChatGPT conversation bubbles for easier navigation in long threads.

## Features

- Collapse/expand individual message bubbles
- Context menu actions: "Collapse all" and "Expand all"
- Collapsed bubbles show approximately 4-5 lines of content
- State persistence across page reloads
- Works with both user and assistant messages

## Installation (Development)

1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Navigate to this extension directory and select `manifest.json`

The extension will be active until you close Firefox or remove it.

## Manual Testing

### Comprehensive Test Checklist:

#### 1. Installation Test
- [ ] Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
- [ ] Click "Load Temporary Add-on..."
- [ ] Select `manifest.json` from the extension directory
- [ ] Verify extension loads without errors

#### 2. Per-Bubble Collapse/Expand Test
- [ ] Navigate to https://chat.openai.com/ with an existing conversation
- [ ] Hover over a message bubble and verify toggle button appears
- [ ] Click the toggle button to collapse the bubble
- [ ] Verify the bubble shows approximately 5 lines with a fade effect at the bottom
- [ ] Click the toggle button again to expand
- [ ] Verify the bubble returns to full height
- [ ] Test with both user and assistant messages

#### 3. Context Menu Test
- [ ] Right-click anywhere on the ChatGPT conversation page
- [ ] Verify "Collapse all" and "Expand all" menu items appear
- [ ] Click "Collapse all"
- [ ] Verify all message bubbles collapse
- [ ] Right-click and select "Expand all"
- [ ] Verify all message bubbles expand

#### 4. Persistence Test
- [ ] Collapse 2-3 specific bubbles in a conversation
- [ ] Note which bubbles are collapsed
- [ ] Refresh the page (F5 or Ctrl+R)
- [ ] Verify the same bubbles remain collapsed after reload
- [ ] Navigate away to a different site
- [ ] Return to the conversation
- [ ] Verify collapse states are still preserved

#### 5. New Message Inheritance Test
- [ ] Use "Collapse all" context menu option
- [ ] Send a new message to ChatGPT
- [ ] Wait for the assistant's response
- [ ] Verify both the new user message and assistant response appear collapsed
- [ ] Use "Expand all"
- [ ] Send another message
- [ ] Verify new messages appear expanded

#### 6. Conversation Switching Test
- [ ] Open a conversation and collapse some bubbles
- [ ] Navigate to a different conversation (click another chat in sidebar)
- [ ] Verify the new conversation has independent collapse states
- [ ] Collapse different bubbles in this conversation
- [ ] Navigate back to the first conversation
- [ ] Verify the original collapse states are restored

#### 7. Keyboard Accessibility Test
- [ ] Use Tab key to navigate to a toggle button
- [ ] Verify the button shows a focus indicator
- [ ] Press Enter or Space to toggle
- [ ] Verify the bubble collapses/expands

#### 8. Options Page Test
- [ ] Navigate to `about:addons`
- [ ] Find "ChatGPT Bubble Collapse" and click "Preferences"
- [ ] Change "Collapsed Lines" to 3
- [ ] Change "Persistence Mode" to "Conversation Default"
- [ ] Change "Default Mode" to "Collapsed"
- [ ] Click "Save"
- [ ] Verify "Settings saved!" message appears
- [ ] Refresh a ChatGPT conversation
- [ ] Collapse a bubble and verify it shows ~3 lines instead of 5
- [ ] Open a new conversation and verify all messages start collapsed

#### 9. Dynamic Content Test
- [ ] Start a new conversation
- [ ] Ask a question that generates a long response
- [ ] While the response is streaming, verify it can be collapsed
- [ ] Scroll up to load older messages (if conversation is long enough)
- [ ] Verify newly loaded messages get toggle buttons

#### 10. Edge Cases Test
- [ ] Test with very short messages (1-2 lines)
  - [ ] Verify collapse still works (minimal visual change is acceptable)
- [ ] Test with messages containing code blocks
  - [ ] Verify code blocks are truncated vertically without breaking layout
- [ ] Test with messages containing images or tables
  - [ ] Verify collapse doesn't cause horizontal overflow

### Expected Behavior Summary:
- Toggle buttons should appear on hover (unless changed in settings)
- Collapsed bubbles show approximately 5 lines (or configured amount)
- Fade gradient appears at bottom of collapsed bubbles
- States persist across page reloads
- Each conversation maintains independent collapse states
- Context menu actions affect all bubbles
- New messages inherit the current default mode

## Configuration

Click the extension's options/preferences to configure:
- Number of visible lines when collapsed
- Persistence mode
- Default state for new conversations

## Privacy

This extension:
- Does NOT collect any data
- Does NOT make any network calls
- Does NOT store message content (only collapse states)
- Operates entirely locally in your browser

See PRIVACY.md for details.
