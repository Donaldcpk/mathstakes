import { Mistake, EducationLevel, TopicCategory, ErrorType } from '../types';
import { withRetry, isOnline } from './networkRetry';
import { toast } from 'react-hot-toast';
// import { getApiConfig, markApiKeyAsInvalid } from './apiKeyManager';
import { processAIResponse } from './formulaFormatter';

// 多模型配置系統
interface ModelConfig {
  name: string;
  apiKey: string;
  requestCount: number;
  lastUsed: number;
  isAvailable: boolean;
  lastError?: string;
  errorCount: number;
}

// 智能負載均衡配置
const MODEL_CONFIGS: ModelConfig[] = [
  {
    name: 'meta-llama/llama-3.1-8b-instruct:free',
    apiKey: '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',
    requestCount: 0,
    lastUsed: 0,
    isAvailable: true,
    errorCount: 0
  },
  {
    name: 'mistralai/mistral-7b-instruct:free',
    apiKey: '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',
    requestCount: 0,
    lastUsed: 0,
    isAvailable: true,
    errorCount: 0
  }
];

// 第三個備用金鑰（使用第三個可用的免費模型）
const BACKUP_CONFIG: ModelConfig = {
  name: 'mistralai/mistral-nemo:free',
  apiKey: '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',
  requestCount: 0,
  lastUsed: 0,
  isAvailable: true,
  errorCount: 0
};

// 載入均衡統計數據
const loadBalancingStats = {
  totalRequests: parseInt(localStorage.getItem('mathstakes_total_requests') || '0'),
  dailyRequests: parseInt(localStorage.getItem('mathstakes_daily_requests') || '0'),
  lastResetDate: localStorage.getItem('mathstakes_last_reset') || new Date().toDateString()
};

// API金鑰驗證函數
const verifyApiKey = async (apiKey: string, modelName: string): Promise<boolean> => {
  try {
    const testBody = {
      model: modelName,
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Mathstakes'
      },
      body: JSON.stringify(testBody)
    });

    return response.status !== 401;
  } catch (error) {
    return false;
  }
};

// 智能模型選擇器 - 增強版
const selectOptimalModel = async (): Promise<ModelConfig> => {
  const now = Date.now();
  const currentDate = new Date().toDateString();
  
  // 重置每日統計
  if (loadBalancingStats.lastResetDate !== currentDate) {
    loadBalancingStats.dailyRequests = 0;
    loadBalancingStats.lastResetDate = currentDate;
    localStorage.setItem('mathstakes_daily_requests', '0');
    localStorage.setItem('mathstakes_last_reset', currentDate);
    
    // 每日重置時，也重置所有模型的可用性
    MODEL_CONFIGS.forEach(config => {
      config.isAvailable = true;
      config.errorCount = 0;
    });
    BACKUP_CONFIG.isAvailable = true;
    BACKUP_CONFIG.errorCount = 0;
  }
  
  // 更新請求統計
  loadBalancingStats.totalRequests++;
  loadBalancingStats.dailyRequests++;
  localStorage.setItem('mathstakes_total_requests', loadBalancingStats.totalRequests.toString());
  localStorage.setItem('mathstakes_daily_requests', loadBalancingStats.dailyRequests.toString());
  
  // 過濾可用模型
  let availableModels = MODEL_CONFIGS.filter(config => config.isAvailable && config.errorCount < 3);
  
  // 如果沒有可用模型，驗證並重置
  if (availableModels.length === 0) {
    console.log('正在驗證API金鑰...');
    
    // 驗證所有模型
    for (const config of MODEL_CONFIGS) {
      const isValid = await verifyApiKey(config.apiKey, config.name);
      if (isValid) {
        config.isAvailable = true;
        config.errorCount = 0;
        availableModels.push(config);
        console.log('成功驗證模型配置');
        break; // 找到一個可用的就停止
      }
    }
    
    // 如果還是沒有，嘗試備用配置
    if (availableModels.length === 0) {
      const backupValid = await verifyApiKey(BACKUP_CONFIG.apiKey, BACKUP_CONFIG.name);
      if (backupValid) {
        BACKUP_CONFIG.isAvailable = true;
        BACKUP_CONFIG.errorCount = 0;
        console.log('使用備用配置');
        return BACKUP_CONFIG;
      }
    }
  }

  if (availableModels.length === 0) {
    throw new Error('所有API金鑰都不可用，請檢查OpenRouter帳戶狀態');
  }
  
  // 智能分散邏輯：根據訪問數量和時間決定使用哪個模型
  let selectedModel: ModelConfig;
  
  if (loadBalancingStats.dailyRequests <= 10) {
    // 前10次請求優先使用第一個可用模型
    selectedModel = availableModels[0];
  } else {
    // 根據請求數量智能分散
    const modelIndex = Math.floor(Math.random() * availableModels.length);
    selectedModel = availableModels[modelIndex];
    
    // 基於負載均衡選擇最少使用的模型
    const leastUsedModel = availableModels.reduce((min, current) => 
      current.requestCount < min.requestCount ? current : min
    );
    
    // 30%概率選擇最少使用的模型，70%概率隨機選擇
    if (Math.random() < 0.3) {
      selectedModel = leastUsedModel;
    }
  }
  
  // 更新選中模型的統計
  selectedModel.requestCount++;
  selectedModel.lastUsed = now;
  
  console.log(`智能負載均衡 - 選擇模型: ${selectedModel.name}`);
  console.log(`當日請求數: ${loadBalancingStats.dailyRequests}, 總請求數: ${loadBalancingStats.totalRequests}`);
  
  return selectedModel;
};

// 標記模型為不可用 - 增強版
const markModelAsUnavailable = (modelName: string, apiKey: string, errorMessage?: string): void => {
  const config = MODEL_CONFIGS.find(c => c.name === modelName && c.apiKey === apiKey);
  if (config) {
    config.errorCount++;
    config.lastError = errorMessage;
    if (config.errorCount >= 3) {
      config.isAvailable = false;
    }
    console.log(`模型配置錯誤計數更新: ${config.errorCount}/3`);
    
    // 檢查是否所有模型都不可用
    const allUnavailable = MODEL_CONFIGS.every(c => !c.isAvailable) && !BACKUP_CONFIG.isAvailable;
    if (allUnavailable && errorMessage?.includes('No allowed providers')) {
      console.error('🚨 API金鑰權限問題檢測到:');
      console.error('所有模型都返回 "No allowed providers" 錯誤');
      console.error('可能的解決方案:');
      console.error('1. 檢查 OpenRouter 帳戶餘額');
      console.error('2. 驗證API金鑰權限設置');
      console.error('3. 確認帳戶狀態是否正常');
      console.error('4. 聯繫 OpenRouter 技術支援');
    }
  }
  
  // 檢查備用配置
  if (BACKUP_CONFIG.name === modelName && BACKUP_CONFIG.apiKey === apiKey) {
    BACKUP_CONFIG.errorCount++;
    BACKUP_CONFIG.lastError = errorMessage;
    if (BACKUP_CONFIG.errorCount >= 3) {
      BACKUP_CONFIG.isAvailable = false;
    }
  }
};

// AI 配置
const AI_CONFIG = {
  responseTimeout: 60000, // 60秒超時
  maxRetries: 4, // 增加重試次數
  retryDelay: 1000,
  temperature: 0.1,
  max_tokens: 4000,
  textGeneration: {
    systemPrompt: '你是一位專業的數學老師，正在幫助學生分析他們的數學錯題。請提供清晰、有教育意義的解釋。',
    userPrompt: (mistake: Mistake) => {
      // 檢查是否有自定義問題
      const hasCustomQuestions = mistake.explanation && (
        mistake.explanation.includes('這種題目的正確答案是什麼') || 
        mistake.explanation.includes('常犯錯誤') || 
        mistake.explanation.includes('避免面對這種題目犯錯')
      );
      
      if (hasCustomQuestions) {
        return `
          請分析以下數學錯題並回答學生的具體問題：
          
          題目: ${mistake.title}
          內容: ${mistake.content}
          學科: ${mistake.subject}
          教育階段: ${mistake.educationLevel}
          
          學生的具體問題:
          ${mistake.explanation}
          
          請針對每個問題提供詳細答案，使用清晰易懂的語言，特別適合${mistake.educationLevel}學生理解。
          避免使用複雜的數學標記，保持解釋通俗易懂。
        `;
      } else {
        return `
          請分析以下數學錯題：
          
          題目: ${mistake.title}
          內容: ${mistake.content}
          學科: ${mistake.subject}
          教育階段: ${mistake.educationLevel}
          
          請提供以下內容:
          1. 錯誤分析 - 學生可能犯了什麼錯誤
          2. 解題步驟 - 完整、清晰的解題步驟
          3. 知識點解釋 - 與錯題相關的重要數學概念
          4. 學習建議 - 如何避免類似錯誤並提高相關數學能力
          
          請使用易於理解的語言，特別適合${mistake.educationLevel}學生理解。
        `;
      }
    }
  },
  imageRecognition: {
    systemPrompt: `
      你是一位專門處理數學題目圖片的AI助手。
      你的任務僅是提取和識別圖片中的數學題目內容，不要進行任何解答或分析。
      請只識別題目的以下信息：
      1. 標題 - 簡短的題目概述
      2. 內容 - 完整的題目文字描述，包括所有條件和問題
      3. 學科 - 具體的數學分支，如代數、幾何等
    `,
  }
};

// API基礎URL
const API_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

// 從本地存儲或智能選擇API配置 - 異步版本
const getOptimalAPIConfig = async (): Promise<{ apiKey: string; model: string }> => {
  // 優先使用用戶設置的金鑰
  const localApiKey = localStorage.getItem('mathstakes_api_key');
  if (localApiKey && localApiKey.startsWith('sk-or-')) {
    console.log('使用用戶設置的API金鑰');
    return {
      apiKey: localApiKey,
      model: 'meta-llama/llama-3.1-8b-instruct:free' // 使用確認存在的免費模型
    };
  }
  
  // 使用智能負載均衡選擇
  const selectedConfig = await selectOptimalModel();
  console.log(`智能選擇配置 - 模型: ${selectedConfig.name}`);
  
  return {
    apiKey: selectedConfig.apiKey,
    model: selectedConfig.name
  };
};

// 檢查圖片 URL 是否有效
const isValidImageUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    return response.ok && contentType.startsWith('image/');
  } catch (error) {
    console.error('檢查圖片URL有效性出錯:', error);
    return false;
  }
  };

// 更新枚舉映射
const mapTopicCategory = (category?: string): TopicCategory | undefined => {
  if (!category) return undefined;
  
  // 去除空白並轉為小寫以進行比較
  const normalizedCategory = category.trim().toLowerCase();
  
  // 根據類別關鍵詞映射到枚舉值
  if (normalizedCategory.includes('數') || 
      normalizedCategory.includes('代數') || 
      normalizedCategory.includes('方程') || 
      normalizedCategory.includes('函數')) {
    return TopicCategory.NUMBER_ALGEBRA;
  }
  
  if (normalizedCategory.includes('度量') || 
      normalizedCategory.includes('圖形') || 
      normalizedCategory.includes('空間')) {
    return TopicCategory.GEOMETRY_MEASURE;
  }
  
  if (normalizedCategory.includes('數據') || 
      normalizedCategory.includes('概率') || 
      normalizedCategory.includes('統計')) {
    return TopicCategory.STATS_PROBABILITY;
  }
  
  // 默認返回
  return TopicCategory.NUMBER_ALGEBRA;
};

// 定義錯題信息響應接口
interface MistakeInfoResponse {
  title: string;
  content: string;
  subject: string;
  educationLevel?: string;
  topicCategory?: string;
  errorType?: string;
  imageUrl?: string;
  createdAt?: string;
}

// 使用 OpenRouter API 從圖片生成題目資訊
export async function generateMistakeInfoFromImage(imageUrl: string): Promise<MistakeInfoResponse> {
  let toastId: string | undefined;
  
  try {
    // 顯示處理中的提示
    toastId = toast.loading('正在識別圖片中的題目...');
    console.log('開始處理圖片識別請求', new Date().toISOString());
    
    // 檢查網絡連接
    if (!isOnline()) {
      toast.dismiss(toastId);
      toast.error('您目前處於離線狀態，無法進行圖片識別');
      console.error('處於離線狀態，無法進行圖片識別');
      throw new Error('網絡離線，無法進行圖片識別');
    }

    // 驗證圖片URL是否有效
    if (!imageUrl || !(await isValidImageUrl(imageUrl))) {
      toast.dismiss(toastId);
      toast.error('圖片格式無效或URL無法訪問');
      throw new Error('圖片格式無效或URL無法訪問');
    }
    
    console.log('開始處理圖片識別請求');
    
    // 使用AI配置中的系統提示詞
    const systemPrompt = AI_CONFIG.imageRecognition.systemPrompt + `
      
      回答格式要求：
      - 只返回一個純JSON物件，不要使用markdown或代碼塊
      - 不要在JSON前後添加任何文字說明
      - 不要使用標記符號，不要使用反引號，不要使用markdown語法
      - 確保輸出是有效的JSON格式
      
      JSON結構：
      {
        "title": "簡短的題目描述",
        "content": "完整的題目文字",
        "subject": "數學分支"
      }
      
      請確保：
      - 準確提取所有題目文字，不要遺漏任何數字、符號或條件
      - 不要添加自己的解釋或分析
      - 只輸出純JSON格式物件，沒有任何額外包裝或標記
    `;
    
    // 構建用戶提示詞
    const userMessage = `請識別這張數學題目的圖片內容並按格式回答`;
    
    // 智能重試機制
    for (let attempt = 1; attempt <= AI_CONFIG.maxRetries; attempt++) {
      try {
        // 獲取最佳API配置
        const { apiKey, model } = await getOptimalAPIConfig();
        
        console.log(`智能選擇配置 - 模型: ${model}`);
        console.log('API設置確認:', !!apiKey);
        
        // 構建請求體
        const requestBody = {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: [
              { type: 'text', text: userMessage },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]}
          ],
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.max_tokens
        };
        
        console.log(`開始API請求 (模型: ${model})`);
        console.log('發送API請求到:', API_BASE_URL);
        console.log('請求頭部包含Authorization:', '是');
        console.log('完整請求內容(不含金鑰):', JSON.stringify({
          model: requestBody.model,
          temperature: requestBody.temperature,
          max_tokens: requestBody.max_tokens,
          messagesCount: requestBody.messages.length
        }));
        
        const fetchResponse = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Mathstakes'
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(AI_CONFIG.responseTimeout)
        });
        
        if (fetchResponse.status === 401) {
          markModelAsUnavailable(model, apiKey, 'API認證失敗');
          throw new Error('API金鑰認證失敗，正在嘗試其他配置');
        }

        if (fetchResponse.status === 429) {
          markModelAsUnavailable(model, apiKey, '請求速率限制');
          throw new Error('API請求頻率過高，正在嘗試其他配置');
        }
        
        if (!fetchResponse.ok) {
          const errorData = await fetchResponse.json().catch(() => ({}));
          console.error('API請求失敗:', fetchResponse.status, '- ', JSON.stringify(errorData));
          throw new Error(`API請求失敗: ${fetchResponse.status}`);
        }
        
                 const response = await fetchResponse.json();
        
        // 檢查是否有回答
        if (!response.choices || response.choices.length === 0) {
          throw new Error('API回應未包含有效內容');
        }

        // 獲取 AI 回答的文本內容
        const aiResponse = response.choices[0].message.content;
        console.log('AI識別結果:', !!aiResponse);
        
        // 嘗試解析 JSON
        try {
          // 處理可能的 JSON 格式問題 - 先清理文本
          let cleanedResponse = aiResponse.trim();
          
          // 如果回應被包裹在反引號或代碼塊中，則移除這些標記
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\n/, '').replace(/\n```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\n/, '').replace(/\n```$/, '');
          }
          
          const result = JSON.parse(cleanedResponse);
          
          // 成功時結束載入提示並顯示成功消息
          toast.dismiss(toastId);
          toast.success('題目識別成功');
          
          // 確保返回值有所有必需的欄位
          return {
            title: result.title || '未命名題目',
            content: result.content || '',
            subject: result.subject || '數學',
            educationLevel: EducationLevel.JUNIOR,
            errorType: ErrorType.UNKNOWN
          };
        } catch (parseError) {
          console.error('JSON解析錯誤:', parseError, 'AI回應:', aiResponse);
          throw new Error('無法解析AI回應格式');
        }
        
      } catch (error: any) {
        console.log(`嘗試 ${attempt}/${AI_CONFIG.maxRetries} 失敗: ${error.message}`);
        
        if (attempt === AI_CONFIG.maxRetries) {
          // 最後一次嘗試失敗
          console.log('所有重試嘗試都失敗');
          toast.dismiss(toastId);
          toast.error('圖片識別失敗，請稍後重試或手動輸入');
          
          // 返回預設值而非拋出錯誤
          return {
            title: '圖片識別暫時不可用',
            content: '目前 AI 服務遇到權限問題，無法進行圖片識別。\n\n可能原因：\n• OpenRouter API 帳戶餘額不足\n• API 金鑰權限受限\n• 服務暫時維護中\n\n建議解決方案：\n1. 檢查 OpenRouter 帳戶狀態\n2. 確認 API 金鑰權限\n3. 稍後重試或手動輸入題目內容',
            subject: '數學',
            errorType: ErrorType.UNKNOWN
          };
        } else {
          const delay = AI_CONFIG.retryDelay * Math.pow(2, attempt - 1);
          console.log(`重試 (${attempt}/${AI_CONFIG.maxRetries - 1}) 等待 ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 這行應該不會被執行到，但為了類型安全
    throw new Error('未知錯誤');
    
  } catch (error) {
    console.error('圖片識別失敗:', error);
    toast.dismiss(toastId); // 確保載入提示被關閉
    
    // 顯示更具體的錯誤消息
    const errorMessage = error instanceof Error ? error.message : '圖片識別失敗';
    toast.error(errorMessage);
    
    // 返回預設值而非拋出錯誤，允許用戶手動輸入
    return {
      title: '',
      content: '',
      subject: '數學',
      errorType: ErrorType.UNKNOWN
    };
  }
}

// 根據錯題生成AI解釋
export const generateAIExplanation = async (mistake: Mistake): Promise<string> => {
  let toastId: string | undefined;
  
  try {
    // 顯示加載提示
    toastId = toast.loading('正在生成AI解釋...');
    
    // 使用AI配置中的提示詞
    const systemPrompt = AI_CONFIG.textGeneration.systemPrompt;
    const userPrompt = AI_CONFIG.textGeneration.userPrompt(mistake);
    
    console.log(`開始生成AI解釋`);
    
    // 智能重試機制
    for (let attempt = 1; attempt <= AI_CONFIG.maxRetries; attempt++) {
      try {
        // 獲取最佳API配置
        const { apiKey, model } = await getOptimalAPIConfig();
        
        console.log(`開始API請求 (嘗試 ${attempt}/${AI_CONFIG.maxRetries})`);
        
        // 構建請求體
        const requestBody = {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: AI_CONFIG.temperature,
          max_tokens: AI_CONFIG.max_tokens
        };
        
        const response = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Mathstakes'
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(AI_CONFIG.responseTimeout)
        });

        if (response.status === 401) {
          markModelAsUnavailable(model, apiKey, 'API認證失敗');
          throw new Error('API金鑰認證失敗，正在嘗試其他配置');
        }

        if (response.status === 429) {
          markModelAsUnavailable(model, apiKey, '請求速率限制');
          throw new Error('API請求頻率過高，正在嘗試其他配置');
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API請求失敗: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('API響應格式無效');
        }

        const content = data.choices[0].message.content;
        
        if (!content || content.trim() === '') {
          throw new Error('AI未返回有效內容');
        }

        // 後處理AI響應
        const processedContent = processAIResponse(content);
        
        console.log('AI解釋生成成功');
        toast.dismiss(toastId);
        toast.success('AI解釋生成成功');
        
        return processedContent;

      } catch (error: any) {
        console.log(`嘗試 ${attempt}/${AI_CONFIG.maxRetries} 失敗: ${error.message}`);
        
        if (attempt === AI_CONFIG.maxRetries) {
          // 最後一次嘗試失敗，返回預設模板
          console.log('所有重試嘗試都失敗，返回預設模板');
          toast.dismiss(toastId);
          toast.error('AI 服務暫時不可用');
          
          return `
### AI 服務暫時不可用

#### ⚠️ 服務狀態
目前 AI 解釋服務遇到權限問題，無法正常運作。

#### 🔍 可能原因
- OpenRouter API 帳戶餘額不足
- API 金鑰權限受限制
- 服務暫時進行維護
- 模型供應商暫時不可用

#### 💡 建議解決方案
1. **檢查帳戶狀態**：登入 [OpenRouter](https://openrouter.ai) 確認帳戶餘額
2. **驗證API權限**：確認API金鑰具有模型調用權限
3. **稍後重試**：等待一段時間後重新嘗試
4. **手動分析**：暫時可以手動分析題目和錯誤

#### 📝 題目信息
- **標題**: ${mistake.title}
- **內容**: ${mistake.content}
- **學科**: ${mistake.subject}
- **階段**: ${mistake.educationLevel}

#### 🎯 基本學習建議
針對數學錯題，通常的分析步驟包括：
1. **找出錯誤點**：仔細比對正確解法
2. **理解概念**：複習相關的數學概念
3. **練習類似題目**：加強相同類型題目的練習
4. **建立解題策略**：歸納有效的解題方法

> 💻 技術提示：請聯繫管理員檢查 API 配置，或稍後重試此功能
          `;
        } else {
          const delay = AI_CONFIG.retryDelay * Math.pow(2, attempt - 1);
          console.log(`重試 (${attempt}/${AI_CONFIG.maxRetries - 1}) 等待 ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // 這行應該不會被執行到，但為了類型安全
    throw new Error('未知錯誤');
    
  } catch (error) {
    console.error('生成AI解釋出錯:', error);
    toast.dismiss(toastId);
    toast.error('AI 服務暫時不可用，請稍後重試');
    
    // 返回一個友好的錯誤消息而不是拋出錯誤
    return `
### ❌ AI 解釋生成失敗

目前無法連接到 AI 服務，請稍後再試。

#### 題目信息
- **標題**: ${mistake.title}
- **內容**: ${mistake.content}
- **學科**: ${mistake.subject}

#### 臨時建議
您可以嘗試：
1. 稍後重新生成AI解釋
2. 手動分析題目錯誤
3. 查閱相關教材或資源
4. 請教老師或同學

> 如果問題持續存在，請聯繫技術支援。
    `;
  }
}; 