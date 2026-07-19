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

    // 2. 清空当前可能存在的残余内容
    editor.innerHTML = ''; 

    // 3. 写入内容：使用 document.execCommand 模拟真实输入
    // 这是绕过 Quill.js/React/Angular 状态拦截最可靠的方式，能直接触发底层的 InputEvent
    const insertSuccess = document.execCommand('insertText', false, text);
    
    // 兜底方案：如果 execCommand 失效，通过 dispatchEvent 模拟 Input
    if (!insertSuccess) {
      console.log("[Gemini Later MAIN] execCommand 失败，尝试模拟 input 事件...");
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));
    }

    console.log("[Gemini Later MAIN] 文本写入完成，等待 UI 状态刷新...");

    // 4. 等待一下，让外部框架（Angular/Lit）检测到输入框的变化并更新发送按钮的状态
    await new Promise(resolve => setTimeout(resolve, 300));

    // 5. 查找此时的发送按钮 (图标应该已经变成了 arrow_upward)
    const sendIcon = document.querySelector('mat-icon[data-mat-icon-name="arrow_upward"]');
    if (!sendIcon) {
      throw new Error("未找到 arrow_upward 发送按钮，可能是文本未正确识别或正处于不可发送状态");
    }

    const sendButton = sendIcon.closest('button');
    if (!sendButton) {
      throw new Error("找到了 icon，但没有找到包裹它的 button 元素");
    }

    // 6. 触发发送
    sendButton.click();
    console.log("[Gemini Later MAIN] 按钮点击成功，问题已发送！");

    // 7. 回传成功状态给 ISOLATED world
    document.dispatchEvent(new CustomEvent('gemini-later-status', {
      detail: { id, status: 'success' }
    }));

  } catch (error) {
    console.error("[Gemini Later MAIN] 处理失败:", error);
    // 回传失败状态
    document.dispatchEvent(new CustomEvent('gemini-later-status', {
      detail: { id, status: 'error', reason: error.message }
    }));
  }
});