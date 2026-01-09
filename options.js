// Options page script for ChatGPT Bubble Collapse extension

// Default settings
const DEFAULT_SETTINGS = {
  collapsedLines: 5,
  buttonVisibility: 'hover',
  persistence: 'perBubble',
  defaultMode: 'expanded'
};

// Load settings from storage and populate form
async function loadSettings() {
  try {
    const result = await browser.storage.local.get('settings');
    const settings = result.settings || DEFAULT_SETTINGS;

    // Populate form fields
    document.getElementById('collapsedLines').value = settings.collapsedLines || 5;
    document.getElementById('persistence').value = settings.persistence || 'perBubble';
    document.getElementById('defaultMode').value = settings.defaultMode || 'expanded';
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings to storage
async function saveSettings(e) {
  e.preventDefault();

  // Get form values
  const collapsedLines = parseInt(document.getElementById('collapsedLines').value, 10);
  const persistence = document.getElementById('persistence').value;
  const defaultMode = document.getElementById('defaultMode').value;

  // Validate
  if (collapsedLines < 3 || collapsedLines > 10) {
    alert('Collapsed lines must be between 3 and 10');
    return;
  }

  // Build settings object
  const settings = {
    collapsedLines,
    buttonVisibility: 'hover', // Not exposed in UI yet
    persistence,
    defaultMode
  };

  try {
    // Save to storage
    await browser.storage.local.set({ settings });

    // Show confirmation
    const status = document.getElementById('status');
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 2000);
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Error saving settings: ' + error.message);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  document.getElementById('optionsForm').addEventListener('submit', saveSettings);
});
