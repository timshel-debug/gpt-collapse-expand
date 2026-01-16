# Privacy Policy

**ChatGPT Bubble Collapse** is a browser extension designed with privacy as a core principle.

## Data Collection

This extension does **NOT**:
- Collect any personal data
- Collect any usage statistics or telemetry
- Store or transmit message content
- Make any network calls to external servers
- Track your browsing activity

## Data Storage

The extension stores **only**:
- User preferences (settings like number of visible lines)
- Collapse/expand state per conversation (stored as simple boolean flags)
- Minimal bubble identifiers (hashed fingerprints, never full message text)

All data is stored **locally** in your browser using the browser's built-in storage API. No data ever leaves your device.

## Permissions

The extension requests:
- `storage`: To save your preferences and collapse states locally
- `tabs`: To communicate between the background script and page content
- `menus`: To add context menu items ("Collapse all", "Expand all")
- `https://chat.openai.com/*`: To operate only on ChatGPT pages

## Third-Party Services

This extension does not use any third-party services, analytics, or tracking.

## Changes

Any changes to this privacy policy will be reflected in extension updates.

## Contact

If you have questions about this privacy policy, please open an issue on the project repository.

---

**Last updated:** January 10, 2026
