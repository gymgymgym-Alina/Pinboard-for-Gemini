document.addEventListener('DOMContentLoaded', () => {
    const inputEl = document.getElementById('question-input');
    const addBtn = document.getElementById('add-btn');
    const listEl = document.getElementById('queue-list');
  
    // 1. 侧边栏打开时，立刻从 storage 中读取并渲染列表
    loadAndRenderQueue();
  
    // 2. 点击 Add 按钮时的保存逻辑
    addBtn.addEventListener('click', () => {
      const text = inputEl.value.trim();
      if (!text) return; // 如果输入为空则不处理
  
      const newItem = {
        id: Date.now().toString(), // 用时间戳作为唯一 ID
        text: text,
        timestamp: Date.now()
      };
  
      // 获取现有队列，然后追加新问题
      chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
        const updatedQueue = [...result.queuedQuestions, newItem];
        
        // 保存回 storage
        chrome.storage.local.set({ queuedQuestions: updatedQueue }, () => {
          inputEl.value = ''; // 清空输入框
          renderQueue(updatedQueue); // 重新渲染列表
        });
      });
    });
  
    // 支持按回车键直接添加
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addBtn.click();
      }
    });
  
    // 读取并渲染的函数
    function loadAndRenderQueue() {
      chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
        renderQueue(result.queuedQuestions);
      });
    }
  
    // 把数据渲染到 HTML 上的函数
    function renderQueue(questions) {
      listEl.innerHTML = ''; // 先清空当前列表
  
      if (questions.length === 0) {
        listEl.innerHTML = '<div class="empty-msg">No questions in queue.</div>';
        return;
      }
  
      // 遍历每一个问题，生成对应的 UI
      questions.forEach((q) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'queue-item';
  
        const textSpan = document.createElement('span');
        textSpan.className = 'question-text';
        textSpan.textContent = q.text;
  
        // ==========================================
        // 👇 新增: Ask Now 手动发送按钮逻辑
        // ==========================================
        const askBtn = document.createElement('button');
        askBtn.className = 'ask-btn';
        askBtn.textContent = 'Ask Now';
  
        askBtn.addEventListener('click', async () => {
          // 查找当前活动的 Gemini 页面
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          
          if (!tab) {
            alert("未找到活动的页面");
            return;
          }
  
          // 按钮进入防抖等待状态
          askBtn.disabled = true;
          askBtn.textContent = 'Checking...';
  
          // 发送消息给 isolated_script.js
          chrome.tabs.sendMessage(tab.id, { 
            action: 'ask_now', 
            id: q.id, 
            text: q.text 
          }, (response) => {
            
            // 如果连接失败（比如网页刚刷新，Content Script 还没注入）
            if (chrome.runtime.lastError) {
              alert("请刷新一下 Gemini 网页，以激活插件功能！");
              askBtn.disabled = false;
              askBtn.textContent = 'Ask Now';
              return;
            }
  
            // 根据 Content Script 的检测结果给出反馈
            if (response && response.status === 'busy') {
              alert("AI 正在回复中，请稍候！");
              askBtn.disabled = false; // 恢复按钮，让用户等下再点
              askBtn.textContent = 'Ask Now';
            } else if (response && response.status === 'sending') {
              askBtn.textContent = 'Sending...'; 
              // 这里不需要恢复 disabled，因为稍后发送成功后，
              // 列表会被重新渲染，这个旧按钮就自动消失了
            }
          });
        });
        // ==========================================
        // 👆 Ask Now 逻辑结束
        // ==========================================
  
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.textContent = 'Delete';
        // 绑定删除事件
        delBtn.addEventListener('click', () => deleteQuestion(q.id));
  
        // 按顺序把元素塞进列表项里
        itemDiv.appendChild(textSpan);
        itemDiv.appendChild(askBtn); // 将 Ask Now 按钮加在文本和删除键中间
        itemDiv.appendChild(delBtn);
        
        listEl.appendChild(itemDiv);
      });
    }
  
    // 删除逻辑
    function deleteQuestion(idToRemove) {
      chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
        // 过滤掉被点击删除的那个 id
        const updatedQueue = result.queuedQuestions.filter(q => q.id !== idToRemove);
        
        // 更新 storage 并重新渲染
        chrome.storage.local.set({ queuedQuestions: updatedQueue }, () => {
          renderQueue(updatedQueue);
        });
      });
    }
  
    // 【修复】：把 storage 变动监听放到 DOMContentLoaded 内部
    // 这样当 Content Script 自动移除已发送的问题时，侧边栏才能正确找到 renderQueue 并刷新
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.queuedQuestions) {
        renderQueue(changes.queuedQuestions.newValue);
      }
    });
  
  });
  
  console.log("侧边栏 JS 文件已经成功加载！");