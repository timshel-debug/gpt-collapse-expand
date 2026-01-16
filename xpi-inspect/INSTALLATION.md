# Installing ChatGPT Bubble Collapse from XPI

## Installation Steps

### Option 1: Direct Installation (Recommended)
1. Open Firefox
2. Drag and drop the `chatgpt-bubble-collapse.xpi` file directly into a Firefox window
3. A dialog will appear asking to confirm installation
4. Click "Add"
5. The extension will be installed and ready to use

### Option 2: File Menu Installation
1. Open Firefox
2. Press `Ctrl+Shift+A` to open the Add-ons Manager (or go to `about:addons`)
3. Click the gear icon and select "Install Add-on from File..."
4. Navigate to and select `chatgpt-bubble-collapse.xpi`
5. Click "Open"
6. A dialog will appear asking to confirm installation
7. Click "Add"

### Option 3: Manual Installation (For Unsigned Extensions)
If Firefox prevents installation due to it being unsigned:
1. Open Firefox
2. Type `about:config` in the address bar
3. Accept the warning
4. Search for `xpinstall.signatures.required`
5. Toggle the value to `false` (for development/testing only)
6. Now try Option 1 or Option 2 above

## Verifying Installation

1. Open Firefox
2. Press `Ctrl+Shift+A` to open the Add-ons Manager
3. Look for "ChatGPT Bubble Collapse" in the Extensions list
4. Navigate to https://chat.openai.com/
5. You should see collapse/expand buttons on message bubbles
6. Right-click on the page to see "Collapse all" and "Expand all" options

## Uninstallation

1. Open Firefox Add-ons Manager (`Ctrl+Shift+A`)
2. Find "ChatGPT Bubble Collapse"
3. Click the three dots menu and select "Remove"

## Notes

- This is a development version and is not signed by Mozilla
- For unsigned extensions, Firefox may show a warning - this is normal
- The extension only works on https://chat.openai.com/
- Your collapse states are saved locally in Firefox's storage - no data is sent to external servers

## Troubleshooting

**Extension doesn't appear in Add-ons Manager:**
- Try restarting Firefox
- Check that the XPI file is not corrupted (try re-downloading or re-packaging)

**Buttons don't appear on ChatGPT:**
- Refresh the ChatGPT page (F5)
- Check that the extension is enabled in the Add-ons Manager
- Check browser console (F12) for any errors

**Settings don't save:**
- Ensure you're clicking the "Save" button on the options page
- Check that "Storage" permission is enabled

For more help, see [README.md](README.md) or [IMPLEMENTATION.md](IMPLEMENTATION.md).
