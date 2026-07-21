document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.getElementById('question-input');
  const addBtn = document.getElementById('add-btn');
  const aiBtn = document.getElementById('ai-recommend-btn');
  const listEl = document.getElementById('queue-list');
  const chipsContainer = document.getElementById('ai-chips-container');
  
  // 设置面板相关元素
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveKeyBtn = document.getElementById('save-key-btn');

  loadAndRenderQueue();
  loadApiKey(); // 启动时加载 API Key

  // ==========================================
  // 👇 API Key 设置与加载逻辑
  // ==========================================
  settingsBtn.addEventListener('click', () => {
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
  });

  function loadApiKey() {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
      } else {
        settingsPanel.style.display = 'block';
      }
    });
  }

  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) return alert("Please enter a valid API Key.");
    
    chrome.storage.local.set({ geminiApiKey: key }, () => {
      alert("API Key saved successfully!");
      settingsPanel.style.display = 'none';
    });
  });

  // ==========================================
  // 👇 事件监听器
  // ==========================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'trigger_ai_suggestions') {
      inputEl.value = request.text; 
      triggerAiRecommendation(request.text);
      sendResponse({ status: 'received' });
    }
  });

  aiBtn.addEventListener('click', () => {
    const text = inputEl.value.trim();
    if (!text) return alert("请先输入一些关键词！");
    triggerAiRecommendation(text);
  });

  addBtn.addEventListener('click', () => {
    const text = inputEl.value.trim();
    if (text) {
      saveQuestionToQueue(text);
      inputEl.value = ''; 
      chipsContainer.innerHTML = ''; 
    }
  });

  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  // ==========================================
  // 👇 核心功能：通过 background.js 调用 Gemini API
  // ==========================================
  async function triggerAiRecommendation(text) {
    chrome.storage.local.get(['geminiApiKey'], async (result) => {
      const apiKey = result.geminiApiKey;
      
      if (!apiKey) {
        alert("请先点击右上角 ⚙️ 按钮，配置您的 Gemini API Key。");
        settingsPanel.style.display = 'block';
        return;
      }

      chipsContainer.innerHTML = '<span style="font-size:12px; color:#666;">✨ AI thinking...</span>';
      
      const myPrompt = `你是一个助手。请根据用户输入的关键词或上下文,生成3个用户可能想追问的简短问题。
重要:必须使用与用户输入相同的语言来生成问题——如果用户输入是中文,生成的问题也必须是中文;如果用户输入是英文,生成的问题也必须是英文。
每个问题不超过20字(中文)或15个单词(英文),直接输出3行问题,不要编号或其他解释。\n\n上下文内容: ${text}`;
      
      //你是一个助手,请根据以下关键词或上下文,生成3个用户可能想追问的简短问题,每个问题不超过20字,直接输出3行问题,不要编号或其他解释。\n\n上下文内容: ${text}`;
      
      chrome.runtime.sendMessage(
        { 
          action: "generateRecommendations", 
          prompt: myPrompt 
        }, 
        (response) => {
          if (chrome.runtime.lastError) {
             console.error("Extension communication error:", chrome.runtime.lastError);
             chipsContainer.innerHTML = '';
             alert("插件内部通信失败，请刷新页面或重载插件。");
             return;
          }

          if (response && response.success) {
            try {
              const aiText = response.data.candidates[0].content.parts[0].text;
              
              const questions = aiText.split('\n')
                .map(q => q.trim().replace(/^[-*•\d\.\s]+/, ''))
                .filter(q => q.length > 0);
                
              renderChips(questions.slice(0, 3)); 
            } catch (error) {
              console.error("AI response parsing failed:", error);
              chipsContainer.innerHTML = '';
              alert("解析 AI 返回的数据失败。");
            }
          } else {
            console.error("AI 推荐失败:", response?.error);
            chipsContainer.innerHTML = '';
            alert(`AI 生成失败: ${response?.error}\n请检查您的 API Key 是否有效。`);
          }
        }
      );
    });
  }

  function renderChips(questions) {
    chipsContainer.innerHTML = '';
    questions.forEach(q => {
      const chip = document.createElement('button');
      chip.textContent = q;
      chip.style.cssText = 'margin: 4px 4px 4px 0; padding: 6px 10px; border-radius: 16px; border: 1px solid #1a73e8; background: #e8f0fe; color: #1a73e8; cursor: pointer; font-size: 12px;';
      
      chip.addEventListener('click', () => {
        saveQuestionToQueue(q); 
        inputEl.value = ''; 
        chipsContainer.innerHTML = ''; 
      });
      chipsContainer.appendChild(chip);
    });
  }

  // ==========================================
  // 👇 列表保存与渲染逻辑
  // ==========================================
  async function saveQuestionToQueue(text) {
    console.log(`[Debug] 准备存储问题, 触发时间: ${Date.now()}, 内容: ${text}`);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab ? tab.url : "";

    const newItem = {
      id: Date.now().toString(),
      text: text,
      timestamp: Date.now(),
      sourceUrl: currentUrl 
    };

    chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
      const updatedQueue = [...result.queuedQuestions, newItem];
      // 写入 Storage，触发 onChange 统一渲染
      chrome.storage.local.set({ queuedQuestions: updatedQueue });
    });
  }

  function loadAndRenderQueue() {
    chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
      renderQueue(result.queuedQuestions);
    });
  }

  async function renderQueue(questions) {
    listEl.innerHTML = ''; 

    if (questions.length === 0) {
      listEl.innerHTML = '<div class="empty-msg">No questions in queue.</div>';
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTabUrl = tab ? tab.url : "";

    questions.forEach((q) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'queue-item';

      const textContainer = document.createElement('div');
      textContainer.style.flex = "1";
      textContainer.style.marginRight = "10px";

      const textSpan = document.createElement('span');
      textSpan.className = 'question-text';
      textSpan.textContent = q.text;
      textContainer.appendChild(textSpan);

      if (q.sourceUrl && q.sourceUrl !== currentTabUrl) {
        const contextTag = document.createElement('div');
        contextTag.textContent = '📌 From other chat';
        contextTag.style.cssText = 'font-size: 10px; color: #e65100; background: #fff3e0; padding: 2px 4px; border-radius: 4px; display: inline-block; margin-top: 4px;';
        textContainer.appendChild(contextTag);
      }

      const askBtn = document.createElement('button');
      askBtn.className = 'ask-btn';
      askBtn.textContent = 'Ask Now';
      askBtn.style.cssText = 'background: #34a853; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 12px; margin-right: 5px; white-space: nowrap;';

      // ==========================================
      // 👇 更新后的 askBtn 点击事件：极简跳转逻辑
      // ==========================================
     // ==========================================
      // 👇 更新后的 askBtn 点击事件：两步走（跳转 + 手动确认发送）
      // ==========================================
      askBtn.addEventListener('click', async () => {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab) return alert("未找到活动的页面");

        askBtn.disabled = true;
        askBtn.textContent = 'Checking...';
        askBtn.style.background = '#ccc'; 
        askBtn.style.color = 'white'; // 确保文字颜色恢复

        const targetUrl = q.sourceUrl;
        const currentUrl = activeTab.url;

        if (!targetUrl) {
           console.log(`[Debug] 旧数据无 sourceUrl, 默认当前页面发送`);
           sendQuestionToTab(activeTab.id, q, askBtn);
           return;
        }

        const targetUrlObj = new URL(targetUrl);
        const currentUrlObj = new URL(currentUrl);
        const isSameContext = (targetUrlObj.origin + targetUrlObj.pathname) === (currentUrlObj.origin + currentUrlObj.pathname);

        if (isSameContext) {
            console.log(`[Debug] 语境匹配, 直接发送`);
            sendQuestionToTab(activeTab.id, q, askBtn);
        } else {
            console.log(`[Debug] 检测到语境不匹配, 准备跳转到: ${targetUrl}`);
            askBtn.textContent = 'Navigating...';

            // 触发页面跳转
            chrome.tabs.update(activeTab.id, { url: targetUrl }, (tab) => {
                const listener = (tabId, changeInfo) => {
                    // 等待页面基础网络框架加载完成
                    if (tabId === activeTab.id && changeInfo.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        console.log("[Debug] 页面基础框架已跳转，等待用户再次点击发送...");
                        
                        // 不再自动发送，而是改变按钮状态提示用户
                        askBtn.disabled = false;
                        askBtn.textContent = '已跳转，请再次点击';
                        askBtn.style.background = '#fbbc05'; // 换成醒目的黄色/橙色
                        askBtn.style.color = '#000'; // 黑色字体增加对比度
                        
                        alert("已跳转到目标对话，请再次点击按钮完成发送！");
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        }
      });
      // ==========================================
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteQuestion(q.id));

      itemDiv.appendChild(textContainer);
      itemDiv.appendChild(askBtn);
      itemDiv.appendChild(delBtn);
      
      listEl.appendChild(itemDiv);
    });
  }

  function deleteQuestion(idToRemove) {
    chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
      const updatedQueue = result.queuedQuestions.filter(q => q.id !== idToRemove);
      chrome.storage.local.set({ queuedQuestions: updatedQueue }); // 写入 Storage 即可，依赖 onChange 渲染
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.queuedQuestions) {
      renderQueue(changes.queuedQuestions.newValue);
    }
  });

});

// ==========================================
// 👇 提取出来的辅助函数 (放在最外层)
// ==========================================

function sendQuestionToTab(tabId, q, askBtn) {
  chrome.tabs.sendMessage(tabId, { 
      action: 'ask_now', 
      id: q.id, 
      text: q.text 
  }, (response) => {
      if (chrome.runtime.lastError) {
          console.error("[Debug] 发送请求失败:", chrome.runtime.lastError.message);
          alert("请刷新一下页面，以激活插件功能！");
          resetAskBtn(askBtn);
          return;
      }

      if (response && response.status === 'busy') {
          alert("AI 正在回复中，请稍候！");
          resetAskBtn(askBtn);
      } else if (response && response.status === 'sending') {
          askBtn.textContent = 'Sending...'; 
      }
  });
}

function resetAskBtn(askBtn) {
  skBtn.disabled = false;
  askBtn.textContent = 'Ask Now';
  askBtn.style.background = '#34a853'; // 恢复原本的绿色
  askBtn.style.color = 'white';

}

console.log("侧边栏 JS (重构跳转版) 已加载！");