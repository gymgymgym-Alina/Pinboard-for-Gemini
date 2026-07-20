// 允许用户通过点击扩展图标来打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getNextQuestion") {
      chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
        const queue = result.queuedQuestions;
        sendResponse({ question: queue.length > 0 ? queue[0] : null });
      });
      return true; // 保持异步通信通道
    }
  
    if (request.action === "removeQuestion") {
      chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
        const updatedQueue = result.queuedQuestions.filter(q => q.id !== request.id);
        chrome.storage.local.set({ queuedQuestions: updatedQueue });
      });
    }
  });
  // Allow users to open the side panel by clicking the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// ⚠️ Replace with your actual Gemini API Key
// In a production extension, consider loading this from chrome.storage or user settings
const GEMINI_API_KEY = "YOUR_API_KEY_HERE";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Existing logic: Get the next question
  if (request.action === "getNextQuestion") {
    chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
      const queue = result.queuedQuestions;
      sendResponse({ question: queue.length > 0 ? queue[0] : null });
    });
    return true; 
  }

  // Existing logic: Remove a question
  if (request.action === "removeQuestion") {
    chrome.storage.local.get({ queuedQuestions: [] }, (result) => {
      const updatedQueue = result.queuedQuestions.filter(q => q.id !== request.id);
      chrome.storage.local.set({ queuedQuestions: updatedQueue });
    });
    return false; // No async response needed
  }

  // NEW LOGIC: Handle Gemini API calls securely via the background script
  if (request.action === "generateRecommendations") {
    const promptText = request.prompt;

    // 4. 从 storage 动态读取用户保存的 API Key
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      const apiKey = result.geminiApiKey;

      if (!apiKey) {
        console.error("❌ [Debug] API Key 为空，未发起请求");
        sendResponse({ success: false, error: "未找到有效的 API Key" });
        return;
      }

      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';
      
      // 2. 严格遵循官方文档的 JSON 结构
      const requestBody = {
        contents: [{
          parts: [{
            text: promptText
          }]
        }]
      };

      // 3. 严格设置正确的请求头
      const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey // Header 鉴权
      };

      // 1. & 4. 打印实际发送的请求内容（脱敏打印 API Key）
      console.group("🚀 [Debug] 发送给 Gemini 的请求信息");
      console.log("Endpoint URL:", url);
      console.log("Headers:", {
        'Content-Type': headers['Content-Type'],
        'x-goog-api-key': apiKey ? `[已获取, 尾号为: ${apiKey.slice(-4)}]` : "[空]"
      });
      console.log("Request Body:", JSON.stringify(requestBody, null, 2));
      console.groupEnd();

      fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      })
      .then(async response => {
        // 5. 捕获完整的 400 错误响应内容
        if (!response.ok) {
          // 尝试解析 Google 返回的具体错误 JSON
          const errorData = await response.json().catch(() => ({ message: "无法解析错误返回体" }));
          console.error("❌ [Debug] 服务器返回完整错误:", errorData);
          
          // 将详细的错误信息抛出，传给前端
          const errorMsg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errorMsg);
        }
        return response.json();
      })
      .then(data => {
        console.log("✅ [Debug] 请求成功，返回数据:", data);
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error("❌ [Debug] Fetch 流程报错:", error);
        sendResponse({ success: false, error: error.message });
      });
    });

    return true; // 告诉 Chrome 我们会异步返回 sendResponse
  }
});