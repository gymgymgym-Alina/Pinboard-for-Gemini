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
// ==========================================
// 👇 新增: 划词悬浮按钮逻辑
// ==========================================
let floatingBtn = null;

document.addEventListener('mouseup', (e) => {
  // 每次鼠标抬起时，先清理旧的按钮
  if (floatingBtn) {
    floatingBtn.remove();
    floatingBtn = null;
  }

  // 获取用户选中的文本
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // 如果有选中文本，且不在我们自己的输入框里
  if (selectedText.length > 0) {
    floatingBtn = document.createElement('button');
    floatingBtn.innerHTML = '✨ 生成追问建议';
    // 直接用内联样式避免额外引入 CSS
    floatingBtn.style.cssText = `
      position: absolute;
      top: ${e.pageY + 10}px;
      left: ${e.pageX + 10}px;
      z-index: 10000;
      background: #f1f3f4;
      border: 1px solid #dadce0;
      border-radius: 16px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      color: #1a73e8;
      font-weight: 500;
    `;
    
    document.body.appendChild(floatingBtn);

    // 点击按钮，发送消息给侧边栏
    floatingBtn.addEventListener('click', (btnEvent) => {
      btnEvent.stopPropagation(); // 阻止冒泡
      chrome.runtime.sendMessage({ 
        action: 'trigger_ai_suggestions', 
        text: selectedText 
      }, (response) => {
        if (chrome.runtime.lastError) {
          alert("请先打开 Gemini Later Queue 侧边栏！");
        }
      });
      floatingBtn.remove();
      window.getSelection().removeAllRanges(); // 取消文本选中状态
    });
  }
});