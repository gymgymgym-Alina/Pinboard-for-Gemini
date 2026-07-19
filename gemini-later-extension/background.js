// 允许用户通过点击扩展图标来打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));