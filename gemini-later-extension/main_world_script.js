console.log("[Gemini Later] main_world_script.js (MAIN World) 已加载");

document.addEventListener('gemini-later-fill', async (e) => {
  const { id, text } = e.detail;
  console.log(`[Gemini Later MAIN] 收到写入指令, 问题 ID: ${id}, 正在写入...`);

  try {
    const editor = document.querySelector('.ql-editor');
    if (!editor) {
      throw new Error("未找到 .ql-editor 元素");
    }

    // 1. 获取焦点
    editor.focus();

    // 2. 清空并写入内容 (绕过 TrustedHTML 限制)
    // 模拟用户按下 Ctrl+A (全选) 
    document.execCommand('selectAll', false, null);
    
    // 模拟用户输入，这会自动覆盖掉刚刚全选的内容，实现“清空+写入”
    const insertSuccess = document.execCommand('insertText', false, text);
    
    // 兜底方案：如果 execCommand 碰巧失效
    if (!insertSuccess) {
      console.log("[Gemini Later MAIN] execCommand 失败，尝试基础 fallback...");
      // 使用 textContent 是安全的，不会触发 TrustedHTML 拦截
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

    // 4. 查找此时的发送按钮 (图标应该已经变成了 arrow_upward)
    const sendIcon = document.querySelector('mat-icon[data-mat-icon-name="arrow_upward"]');
    if (!sendIcon) {
      throw new Error("未找到 arrow_upward 发送按钮，可能是文本未正确识别");
    }

    const sendButton = sendIcon.closest('button');
    if (!sendButton) {
      throw new Error("找到了 icon，但没有找到 button 元素");
    }

    // 5. 触发发送
    sendButton.click();
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