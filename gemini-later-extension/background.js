// 允许用户通过点击扩展图标来打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getNextQuestion") {
      chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
        const queue = result.queuedQuestions;
        sendResponse({ question: queue.length > 0 ? queue[0] : null });
      });
      return true; // 保持异步通信通道
    }
  
    if (request.action === "removeQuestion") {
      chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
        const updatedQueue = result.queuedQuestions.filter(q => q.id !== request.id);
        chrome.storage.local.set({ queuedQuestions: updatedQueue });
      });
    }
  });