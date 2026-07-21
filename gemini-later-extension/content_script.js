console.log("[Gemini Later] Content script loaded.");

let isGenerating = false;
let isProcessingQueue = false;

// 监听 AI 是否在生成中 (观察全局停止按钮)
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-mat-icon-name') {
      const iconName = mutation.target.getAttribute('data-mat-icon-name');
      if (iconName === 'stop') {
        isGenerating = true;
      } else if (isGenerating && (iconName === 'mic' || iconName === 'arrow_upward' || iconName === 'send')) {
        isGenerating = false;
        // 如果有队列处理逻辑，可以在这里触发
      }
    }
  });
});
observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-mat-icon-name'] });

// ==========================================
// 👇 监听来自 Side Panel 的消息
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 1. 探测逻辑
  if (request.action === 'check_ready') {
    const editor = getGeminiEditor();
    sendResponse({ status: editor ? 'ready' : 'waiting' });
    return true; 
  }

  // 2. 核心提问逻辑：接收到 Ask Now 指令后，等待页面就绪并发送
  if (request.action === 'ask_now') {
    if (isGenerating) {
      sendResponse({ status: 'busy' });
      return true;
    }

    console.log(`[Gemini Later] 🚀 收到 Ask Now 指令，准备注入文本: "${request.text}"`);

    const checkAndExecute = () => {
      const editor = getGeminiEditor();
      
      if (!editor) {
        console.log(`[Gemini Later] 🔍 尚未找到输入框，继续等待...`);
        return false;
      }

      console.log(`[Gemini Later] ✅ 找到输入框，开始依次尝试注入策略...`);
      sendResponse({ status: 'sending' });

      const text = request.text;
      let injectSuccess = false;

      // ==========================================
      // 方案 A: 显式建立 Selection Range
      // ==========================================
      console.log(`[Gemini Later] 🛠️ 尝试方案 A: 建立 Selection Range...`);
      editor.focus();
      try {
        const range = document.createRange();
        const selection = window.getSelection();

        // 先确保编辑器内至少有一个可以放光标的位置
        if (editor.childNodes.length === 0) {
          editor.appendChild(document.createElement('p'));
        }

        range.selectNodeContents(editor);
        range.collapse(false); // 光标移到末尾
        selection.removeAllRanges();
        selection.addRange(range);

        // 现在再执行 insertText
        document.execCommand('insertText', false, text);
        
        const hasTextA = editor.textContent.includes(text);
        console.log(`[Gemini Later] 方案 A 执行完毕, editor.textContent 是否包含目标文字:`, hasTextA);
        if (hasTextA) injectSuccess = true;
      } catch (e) {
        console.error(`[Gemini Later] 方案 A 报错:`, e);
      }

      // ==========================================
      // 方案 B: 派发标准 InputEvent
      // ==========================================
      if (!injectSuccess) {
        console.log(`[Gemini Later] 🛠️ 尝试方案 B: 派发标准 InputEvent...`);
        try {
          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: text
          });
          editor.dispatchEvent(inputEvent);
          
          const hasTextB = editor.textContent.includes(text);
          console.log(`[Gemini Later] 方案 B 执行完毕, editor.textContent 是否包含目标文字:`, hasTextB);
          if (hasTextB) injectSuccess = true;
        } catch (e) {
          console.error(`[Gemini Later] 方案 B 报错:`, e);
        }
      }

      // ==========================================
      // 方案 C: 检查 Quill 实例 (注意隔离世界问题)
      // ==========================================
      if (!injectSuccess) {
        console.log(`[Gemini Later] 🛠️ 尝试方案 C: 检查是否能直接访问编辑器实例...`);
        console.log(`[Gemini Later] 探测 editor.__quill:`, editor.__quill);
        console.log(`[Gemini Later] 探测 window.Quill:`, window.Quill);
        
        if (editor.__quill) {
          try {
            editor.__quill.setText(text);
            console.log(`[Gemini Later] 方案 C 执行完毕, 已直接调用 Quill API`);
            injectSuccess = true;
          } catch (e) {
            console.error(`[Gemini Later] 方案 C 报错:`, e);
          }
        } else {
          console.log(`[Gemini Later] 方案 C 失败: 找不到 Quill 实例(可能不是Quill或处于插件隔离环境中)`);
        }
      }

      // ==========================================
      // 兜底：强行触发通用事件并尝试发送
      // ==========================================
      // 无论前面谁成功了，都触发一下普通的 input/change 事件，刺激框架的双向绑定刷新
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));

      // 等待 800ms 让框架把麦克风图标变成发送图标
      setTimeout(() => {
        const sendBtn = getSendButton();
        
        if (sendBtn && !sendBtn.disabled) {
          console.log("[Gemini Later] 🎉 找到激活的发送按钮，点击发送！");
          sendBtn.click();
          
          // 通知后台删掉这条数据
          chrome.runtime.sendMessage({ action: "removeQuestion", id: request.id });
        } else {
          console.error("[Gemini Later] ❌ 文字尝试填入完毕，但未找到可用的发送按钮。当前编辑器内容为:", editor.textContent);
        }
      }, 800);

      return true;
    };

    // 首次检测
    if (!checkAndExecute()) {
      console.log(`[Gemini Later] ⏳ 输入框未就绪，启动 MutationObserver 等待 (限时15秒)...`);
      
      let domObserver;
      const timeoutId = setTimeout(() => {
        if (domObserver) domObserver.disconnect();
        console.error("[Gemini Later] ❌ 等待输入框出现超时");
      }, 15000);

      domObserver = new MutationObserver(() => {
        if (checkAndExecute()) {
          domObserver.disconnect(); 
          clearTimeout(timeoutId); 
        }
      });

      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    return true; 
  }
});

// ==========================================
// 👇 辅助工具函数：精准定位 Gemini 的 DOM 元素
// ==========================================

function getGeminiEditor() {
  // 兼容多种可能出现的输入框结构
  return document.querySelector('.ql-editor') || 
         document.querySelector('rich-textarea div[contenteditable="true"]') ||
         document.querySelector('p[data-placeholder]')?.parentElement ||
         document.querySelector('[contenteditable="true"]:not([style*="display: none"])');
}

function getSendButton() {
  // 严格寻找“发送”按钮，避开“麦克风”按钮
  let btn = document.querySelector('button[aria-label*="Send"]') || 
            document.querySelector('button[aria-label*="发送"]');
  
  if (btn) return btn;

  const icon = document.querySelector('mat-icon[data-mat-icon-name="send"]') || 
               document.querySelector('mat-icon[data-mat-icon-name="arrow_upward"]');
               
  if (icon) return icon.closest('button');

  return null;
}