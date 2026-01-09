# Debugging Guide - ChatGPT Bubble Collapse

The extension has been updated with comprehensive debugging capabilities. Follow this checklist to verify everything is working.

## ✅ Debugging Checklist (Do in Order)

### 1. Check Background Script Loads

**Where:** Browser Console (Ctrl+Shift+J in Firefox)

**Expected output:**
```
[CGCC] background boot
[CGCC] menus created
```

**If missing:**
- The background script isn't loading
- Check manifest.json permissions
- Try reloading the extension

### 2. Verify Context Menus Appear

**Action:** Right-click anywhere on a ChatGPT page

**Expected:** You should see:
- "Collapse all"
- "Expand all"

**If missing:**
- Check browser console for `[CGCC] menus created`
- Verify you're on https://chat.openai.com/* or https://chatgpt.com/*
- Check that "menus" permission exists in manifest.json

### 3. Check Content Script Loads

**Where:** Page Console (F12 → Console tab on ChatGPT page)

**Expected output:**
```
[CGCC] content script loaded https://chat.openai.com/...
```

**How to verify manually:**
In the page console, run:
```js
typeof window.__CGCC_LOADED__
```

Should return: `"boolean"`

**If undefined:**
- Content script isn't loading
- Check you're on the right domain (chat.openai.com or chatgpt.com)
- Check manifest.json content_scripts matches

### 4. Verify DOM Selectors Work

**Where:** Page Console (F12 on ChatGPT page)

**Test command:**
```js
document.querySelectorAll('[data-message-author-role]').length
```

**Expected:** > 0 (should find message bubbles)

**If 0:**
- ChatGPT's DOM structure has changed
- You'll need to update selectors in content-script.js
- Inspect a message bubble to find new identifying attributes

### 5. Test Menu Commands

**Action:** Click "Collapse all" from right-click menu

**Expected in browser console:**
```
[CGCC] menu clicked: cgcc-collapse-all on https://...
[CGCC] command sent successfully: COLLAPSE_ALL
```

**If missing:**
- Menu click handler isn't firing
- Check permissions
- Check URL filtering in background.js

### 6. Verify Buttons Appear

**Where:** ChatGPT page with messages

**Expected:**
- Hover over any message bubble
- Should see "Collapse" or "Expand" button in top-right corner

**If missing:**
- Content script loaded but bubble detection failed
- Check step 4 (DOM selectors)
- Check browser console for errors

## Common Issues & Fixes

### Issue: "browser is not defined"
**Fix:** Already handled in code, but if you see this, ensure you're using the `browser` API (not `chrome`)

### Issue: Wrong domain (chatgpt.com vs chat.openai.com)
**Fix:** ✅ Already fixed - both domains are now supported

### Issue: Menus don't appear for temporary add-on
**Fix:** ✅ Already fixed - `ensureMenus()` is called immediately on load

### Issue: Extension loads but nothing happens
**Likely cause:** DOM selectors don't match current ChatGPT UI
**Debug:** Run step 4 above to check selector compatibility

## Full Debugging Session Example

1. **Load extension:**
   - Go to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `chatgpt-bubble-collapse.xpi`

2. **Open Browser Console (Ctrl+Shift+J):**
   ```
   [CGCC] background boot ✓
   [CGCC] menus created ✓
   ```

3. **Navigate to https://chatgpt.com/ or https://chat.openai.com/**

4. **Open Page Console (F12):**
   ```
   [CGCC] content script loaded https://chatgpt.com/... ✓
   ```

5. **Test in console:**
   ```js
   window.__CGCC_LOADED__  // Should be true
   document.querySelectorAll('[data-message-author-role]').length  // Should be > 0
   ```

6. **Right-click page → see "Collapse all" and "Expand all" ✓**

7. **Hover over message → see collapse/expand button ✓**

## If All Else Fails

1. Clear Firefox extension cache
2. Completely close and restart Firefox
3. Reload the extension
4. Check console logs at each step
5. If DOM selectors fail (step 4 returns 0), you'll need to inspect ChatGPT's current HTML structure and update selectors

## Logs Reference

| Log Message | Location | Meaning |
|------------|----------|---------|
| `[CGCC] background boot` | Browser Console | Background script started |
| `[CGCC] menus created` | Browser Console | Context menus registered |
| `[CGCC] onInstalled fired` | Browser Console | Extension installed/updated |
| `[CGCC] menu clicked: ...` | Browser Console | User clicked context menu |
| `[CGCC] command sent successfully` | Browser Console | Message sent to content script |
| `[CGCC] content script loaded` | Page Console | Content script injected into page |

All logs are prefixed with `[CGCC]` for easy filtering.
