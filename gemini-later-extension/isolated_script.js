console.log("[Gemini Later] isolated_script.js 已加载");

let isGenerating = false;
let isProcessingQueue = false;

// 1. 监听 AI 回复状态变化 (升级为状态快照查询法)
const observer = new MutationObserver(() => {
  // 不再去解析具体的 mutation detail，而是直接看当前 DOM 里的真实状态
  const stopIcon = document.querySelector('mat-icon[data-mat-icon-name="stop"]');
  const micIcon = document.querySelector('mat-icon[data-mat-icon-name="mic"]');
  const arrowIcon = document.querySelector('mat-icon[data-mat-icon-name="arrow_upward"]');

  if (stopIcon && !isGenerating) {
    console.log("[Gemini Later] 检测到 AI 开始生成 (状态: stop)");
    isGenerating = true;
  } else if (!stopIcon && (micIcon || arrowIcon) && isGenerating) {
    console.log("[Gemini Later] 检测到生成结束 (状态恢复)");
    isGenerating = false;
    checkAndProcessQueue();
  }
});

// 监听配置增加 childList: true，捕捉节点的销毁和重建
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['data-mat-icon-name']
});

// 2. 检查队列并发送指令
function checkAndProcessQueue() {
  if (isProcessingQueue) return;

  chrome.storage.local.get(['queuedQuestions'], (result) => {
    const queue = result.queuedQuestions || [];
    if (queue.length > 0) {
      isProcessingQueue = true;
      const nextQuestion = queue[0];
      
      console.log(`[Gemini Later] 队列不为空，准备发送问题 ID: ${nextQuestion.id}`);
      
      // 派发自定义事件给 MAIN world
      document.dispatchEvent(new CustomEvent('gemini-later-fill', {
        detail: {
          id: nextQuestion.id,
          text: nextQuestion.text
        }
      }));
    } else {
      console.log("[Gemini Later] 队列为空，等待用户新输入。");
    }
  });
}

// 3. 监听来自 MAIN world 的结果报告
document.addEventListener('gemini-later-status', (e) => {
  const { id, status, reason } = e.detail;
  
  if (status === 'success') {
    console.log(`[Gemini Later] MAIN World 报告发送成功! ID: ${id}`);
    
    // 从队列中移除已发送的问题
    chrome.storage.local.get(['queuedQuestions'], (result) => {
      let queue = result.queuedQuestions || [];
      queue = queue.filter(q => q.id !== id);
      chrome.storage.local.set({ queuedQuestions: queue }, () => {
        console.log(`[Gemini Later] 存储更新完毕，已移除问题 ID: ${id}`);
        isProcessingQueue = false;
        
        // 注意：这里不需要立刻递归调用 checkAndProcessQueue，
        // 因为发送成功后，AI 会重新变成 'stop' 状态，等下一轮结束自然会触发。
      });
    });
  } else {
    console.error(`[Gemini Later] MAIN World 报告发送失败! ID: ${id}, 原因: ${reason}`);
    isProcessingQueue = false;
  }
});