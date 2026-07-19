console.log("[Gemini Later] Content script loaded.");

let isGenerating = false;
let isProcessingQueue = false;

// 定义 MutationObserver
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-mat-icon-name') {
      const iconName = mutation.target.getAttribute('data-mat-icon-name');
      
      if (iconName === 'stop') {
        isGenerating = true;
      } else if (isGenerating && (iconName === 'mic' || iconName === 'arrow_upward')) {
        isGenerating = false;
        if (!isProcessingQueue) {
          isProcessingQueue = true;
          setTimeout(() => checkAndSendNextQuestion(), 1000);
        }
      }
    }
  });
});

observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-mat-icon-name'] });

function checkAndSendNextQuestion() {
  // 核心改动：不再直接调用 chrome.runtime，改用 Window 消息传递或确保 chrome 对象存在
  // 这里我们加一个重试逻辑，确保 chrome 对象被识别
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: "getNextQuestion" }, (response) => {
      if (!response || !response.question) {
        isProcessingQueue = false;
        return;
      }
      
      const nextQuestion = response.question;
      const editor = document.querySelector('.ql-editor');
      if (editor) {
        editor.focus();
        document.execCommand('insertText', false, nextQuestion.text);
        
        setTimeout(() => {
          const sendBtn = document.querySelector('mat-icon[data-mat-icon-name="arrow_upward"]')?.closest('button');
          if (sendBtn) {
            sendBtn.click();
            chrome.runtime.sendMessage({ action: "removeQuestion", id: nextQuestion.id });
          }
          isProcessingQueue = false;
        }, 800);
      }
    });
  } else {
    console.error("[Gemini Later] 致命错误：chrome 对象在当前网页环境不可用");
    isProcessingQueue = false;
  }
}