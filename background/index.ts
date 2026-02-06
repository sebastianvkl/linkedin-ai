// Background script entry point
// Message handlers are automatically loaded from background/messages/

// Set up side panel to open when extension icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set panel behavior:', error))

// Also handle action click explicitly as fallback
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Auto-reload LinkedIn tabs when extension is updated
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update' || details.reason === 'install') {
    // Re-set panel behavior on install/update
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Failed to set panel behavior:', error))

    chrome.tabs.query({ url: '*://*.linkedin.com/*' }, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.reload(tab.id)
        }
      }
    })
  }
})

export {}
