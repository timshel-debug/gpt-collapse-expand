// Background script for ChatGPT Bubble Collapse extension
// Manages context menu integration for Firefox MV3

console.log("[CGCC] background boot");

// Create context menu items
async function ensureMenus() {
  try {
    await browser.menus.removeAll();
    browser.menus.create({
      id: "cgcc-collapse-all",
      title: "Collapse all",
      contexts: ["all"]
    });
    browser.menus.create({
      id: "cgcc-expand-all",
      title: "Expand all",
      contexts: ["all"]
    });
    console.log("[CGCC] menus created");
  } catch (e) {
    console.warn("[CGCC] ensureMenus failed", e);
  }
}

// Create menus immediately (for temporary add-on loads)
ensureMenus();

// Create menus on install
browser.runtime.onInstalled.addListener(() => {
  console.log("[CGCC] onInstalled fired");
  ensureMenus();
});

// Recreate menus on startup
browser.runtime.onStartup.addListener(() => {
  console.log("[CGCC] onStartup fired");
  ensureMenus();
});

// Handle menu clicks
browser.menus.onClicked.addListener((info, tab) => {
  console.log("[CGCC] menu clicked:", info.menuItemId, "on", tab.url);
  
  // Verify we're on a ChatGPT page
  if (!tab.url || (!tab.url.startsWith("https://chat.openai.com/") && !tab.url.startsWith("https://chatgpt.com/"))) {
    console.warn("[CGCC] Not on ChatGPT domain:", tab.url);
    return;
  }

  // Determine command type based on menu item
  let command;
  if (info.menuItemId === "cgcc-collapse-all") {
    command = { type: "COLLAPSE_ALL" };
  } else if (info.menuItemId === "cgcc-expand-all") {
    command = { type: "EXPAND_ALL" };
  } else {
    return;
  }

  // Send command to content script
  browser.tabs.sendMessage(tab.id, command).then(() => {
    console.log("[CGCC] command sent successfully:", command.type);
  }).catch(error => {
    console.warn("[CGCC] Failed to send message to content script:", error.message);
  });
});
