console.log("[Gemini Later] main_world_script.js (MAIN World) 已加载");

document.addEventListener('gemini-later-fill', async (e) => {
  const { id, text } = e.detail;
  console.log(`[Gemini Later MAIN] 收到写入指令, 问题 ID: ${id}, 正在写入...`);

  try {
    // 1. 兼容多种可能出现的 Gemini 输入框结构
    const editor = document.querySelector('.ql-editor') || 
                   document.querySelector('rich-textarea div[contenteditable="true"]') ||
                   document.querySelector('p[data-placeholder]')?.parentElement ||
                   document.querySelector('[contenteditable="true"]:not([style*="display: none"])');

    if (!editor) {
      throw new Error("未找到任何支持 contenteditable 的输入框元素");
    }

    // 2. 获取焦点并写入
    editor.focus();

    // 清空并写入内容 (绕过 TrustedHTML 限制)
    document.execCommand('selectAll', false, null);
    const insertSuccess = document.execCommand('insertText', false, text);
    
    // 兜底方案
    if (!insertSuccess) {
      console.log("[Gemini Later MAIN] execCommand 失败，尝试基础 fallback...");
      editor.textContent = text; 
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
    }

    console.log("[Gemini Later MAIN] 文本写入完成，等待 UI 状态刷新...");

    // 3. 等待 Angular/Lit 框架更新状态
    await new Promise(resolve => setTimeout(resolve, 300));

    // 4. 兼容查找发送按钮 (避开麦克风)
    let sendBtn = document.querySelector('button[aria-label*="Send"]') || 
                  document.querySelector('button[aria-label*="发送"]');
    
    if (!sendBtn) {
        const icon = document.querySelector('mat-icon[data-mat-icon-name="send"]') || 
                     document.querySelector('mat-icon[data-mat-icon-name="arrow_upward"]');
        if (icon) sendBtn = icon.closest('button');
    }

    if (!sendBtn) {
      throw new Error("未找到发送按钮，可能是文本未正确识别导致按钮未激活");
    }

    // 5. 触发发送
    sendBtn.click();
    console.log("[Gemini Later MAIN] 按钮点击成功，问题已发送！");

    // 6. 回传成功状态给 ISOLATED world
    document.dispatchEvent(new CustomEvent('gemini-later-status', {
      detail: { id, status: 'success' }
    }));

  } catch (error) {
    console.error("[Gemini Later MAIN] 处理失败:", error);
    document.dispatchEvent(new CustomEvent('gemini-later-status', {
      detail: { id, status: 'error', reason: error.message }
    }));
  }
});