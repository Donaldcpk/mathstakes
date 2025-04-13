// Vercel API 路由處理 OpenRouter API 請求
export default async function handler(req, res) {
  // 設置 CORS 頭部
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 處理 OPTIONS 請求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允許 POST 請求' });
  }
  
  try {
    // 從環境變數獲取 API 密鑰
    const apiKey = process.env.OPENROUTER_API_KEY_1;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API 密鑰未設置' });
    }
    
    // 從請求中獲取必要數據
    const { model, messages, temperature, maxTokens } = req.body;
    
    console.log('收到請求:', { model, temperature, maxTokens });
    console.log('消息數量:', messages?.length || 0);
    
    // 創建 OpenRouter API 請求
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': req.headers.host || 'mathstakes.vercel.app',
        'X-Title': 'Mathstakes'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });
    
    // 獲取 API 響應
    const data = await response.json();
    console.log('API 響應狀態:', response.status);
    
    // 返回響應給客戶端
    return res.status(response.status).json(data);
    
  } catch (error) {
    console.error('API 代理錯誤:', error);
    return res.status(500).json({ error: '服務器錯誤: ' + error.message });
  }
} 