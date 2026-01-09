# Troubleshooting XPI Installation Issues

## If you get "NS_ERROR_FAILURE [nsIZipReader.open]"

This error means Firefox couldn't read the XPI file. Try these solutions:

### Solution 1: Clear Firefox Cache and Restart (Recommended)
1. Close Firefox completely
2. Delete Firefox's extension cache:
   - Press `Win + R`
   - Type: `%APPDATA%\Mozilla\Firefox\Profiles`
   - Find the default profile folder (usually named with random characters)
   - Delete the `extensions.json` file
3. Restart Firefox
4. Try installing the XPI again via drag-and-drop

### Solution 2: Use about:debugging (Alternative)
1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Browse to the XPI file location: `C:\dev\firefox-extensions\chatgpt-bubble-collapse.xpi`
5. Select the file and click "Open"

### Solution 3: Reinstall from Fresh XPI
The XPI has been recreated. If the old version was corrupted:
1. Close Firefox
2. Delete `C:\dev\firefox-extensions\chatgpt-bubble-collapse.xpi`
3. Recreate it by running:
   ```powershell
   cd c:\dev\firefox-extensions
   powershell -Command "
   Compress-Archive -Path manifest.json, background.js, content-script.js, content-styles.css, options.html, options.js -DestinationPath chatgpt-bubble-collapse.zip -Force
   Rename-Item chatgpt-bubble-collapse.zip chatgpt-bubble-collapse.xpi -Force
   "
   ```
4. Restart Firefox
5. Try installing again

### Solution 4: Disable Signature Verification (Development Only)
If you want to install unsigned extensions:
1. Open Firefox
2. Type `about:config` in the address bar
3. Accept the warning
4. Search for `xpinstall.signatures.required`
5. Toggle it to `false`
6. Try installing the XPI again
7. **Note**: This is for development/testing only. Re-enable it for production.

## File Structure Verification

The XPI must have this exact structure at the root:
```
✓ manifest.json        ← MUST be at root
✓ background.js
✓ content-script.js
✓ content-styles.css
✓ options.html
✓ options.js
```

NOT this:
```
✗ chatgpt-bubble-collapse/manifest.json  ← Wrong! In subfolder
```

## Verification Check

Your current XPI structure is verified as correct with `manifest.json` at the root.

## Still Having Issues?

1. **Verify file integrity**: Check that `chatgpt-bubble-collapse.xpi` is 8+ KB
2. **Check Firefox version**: Must be Firefox 109+ for MV3 support
3. **Check browser console**: Open Developer Tools (F12) → Console tab for errors
4. **Try alternative browsers temporarily**: Test if you have permissions issues
