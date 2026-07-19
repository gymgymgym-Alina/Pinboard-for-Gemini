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
  
        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.textContent = 'Delete';
        // 绑定删除事件
        delBtn.addEventListener('click', () => deleteQuestion(q.id));
  
        itemDiv.appendChild(textSpan);
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
  });

// 监听 Storage 的变化。如果是 content_script 在后台消耗了问题，这里会自动触发刷新
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.queuedQuestions) {
      renderQueue(changes.queuedQuestions.newValue);
    }
  });
  console.log("侧边栏 JS 文件已经成功加载！");