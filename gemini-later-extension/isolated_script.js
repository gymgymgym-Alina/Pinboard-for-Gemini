console.log("[Gemini Later] isolated_script.js 已加载 (手动触发模式)");

// 1. 监听来自侧边栏的手动发送指令
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ask_now') {
    // 瞬间查询 DOM 状态：只要屏幕上有 stop 图标，说明 AI 正在忙
    const isBusy = !!document.querySelector('mat-icon[data-mat-icon-name="stop"]');

    if (isBusy) {
      console.log("[Gemini Later] 收到 Ask Now，但 AI 正在回复，已拦截");
      sendResponse({ status: 'busy' }); 
      return true;
    }

    console.log(`[Gemini Later] 收到 Ask Now，AI 空闲，准备发送问题 ID: ${request.id}`);
    
    // 派发自定义事件给 MAIN world 去执行写入和点击
    document.dispatchEvent(new CustomEvent('gemini-later-fill', {
      detail: {
        id: request.id,
        text: request.text
      }
    }));

    sendResponse({ status: 'sending' });
    return true; // 保持消息通道开启
  }
});

// 2. 监听来自 MAIN world 的结果报告 (逻辑几乎不变)
document.addEventListener('gemini-later-status', (e) => {
  const { id, status, reason } = e.detail;
  
  if (status === 'success') {
    console.log(`[Gemini Later] MAIN World 报告发送成功! ID: ${id}`);
    
    // 发送成功后，从队列中移除
    chrome.storage.local.get(['queuedQuestions'], (result) => {
      let queue = result.queuedQuestions || [];
      queue = queue.filter(q => q.id !== id);
      chrome.storage.local.set({ queuedQuestions: queue }, () => {
        console.log(`[Gemini Later] 存储更新完毕，已移除问题 ID: ${id}`);
      });
    });
  } else {
    console.error(`[Gemini Later] MAIN World 报告发送失败! ID: ${id}, 原因: ${reason}`);
  }
});