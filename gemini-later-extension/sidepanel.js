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
          // 如果没有 Key，默认展开设置面板提示用户输入
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
      
      const myPrompt = `你是一个助手,请根据以下关键词或上下文,生成3个用户可能想追问的简短问题,每个问题不超过20字,直接输出3行问题,不要编号或其他解释。\n\n上下文内容: ${text}`;
      
      // 向 background.js 发送请求，不再前端直接 fetch
      chrome.runtime.sendMessage(
        { 
          action: "generateRecommendations", 
          prompt: myPrompt 
        }, 
        (response) => {
          // 处理通信错误
          if (chrome.runtime.lastError) {
             console.error("Extension communication error:", chrome.runtime.lastError);
             chipsContainer.innerHTML = '';
             alert("插件内部通信失败，请刷新页面或重载插件。");
             return;
          }

          if (response && response.success) {
            try {
              // 解析从 background.js 返回的数据
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
  
    // 渲染推荐标签
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
    // 👇 列表保存与渲染逻辑 (保持不变)
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
        chrome.storage.local.set({ queuedQuestions: updatedQueue }, () => {
          //renderQueue(updatedQueue); 
        });
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
  
        askBtn.addEventListener('click', async () => {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab) return alert("未找到活动的页面");
  
          askBtn.disabled = true;
          askBtn.textContent = 'Checking...';
          askBtn.style.background = '#ccc'; 
  
          chrome.tabs.sendMessage(activeTab.id, { 
            action: 'ask_now', 
            id: q.id, 
            text: q.text 
          }, (response) => {
            if (chrome.runtime.lastError) {
              alert("请刷新一下 Gemini 网页，以激活插件功能！");
              askBtn.disabled = false;
              askBtn.textContent = 'Ask Now';
              askBtn.style.background = '#34a853';
              return;
            }
  
            if (response && response.status === 'busy') {
              alert("AI 正在回复中，请稍候！");
              askBtn.disabled = false;
              askBtn.textContent = 'Ask Now';
              askBtn.style.background = '#34a853';
            } else if (response && response.status === 'sending') {
              askBtn.textContent = 'Sending...'; 
            }
          });
        });
  
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
        chrome.storage.local.set({ queuedQuestions: updatedQueue }, () => {
          renderQueue(updatedQueue);
        });
      });
    }
  
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.queuedQuestions) {
        renderQueue(changes.queuedQuestions.newValue);
      }
    });
  
  });
  
  console.log("侧边栏 JS (API Key 版本) 已加载！");