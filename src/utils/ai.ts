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
}

// 智能負載均衡配置
const MODEL_CONFIGS: ModelConfig[] = [
  {
    name: 'mistralai/mistral-small-3.2-24b-instruct:free',
    apiKey: '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',
    requestCount: 0,
    lastUsed: 0,
    isAvailable: true
  },
  {
    name: 'meta-llama/llama-4-maverick:free',
    apiKey: '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',
    requestCount: 0,
    lastUsed: 0,
    isAvailable: true
  }
];

// 第三個備用金鑰（使用第一個模型）
const BACKUP_CONFIG: ModelConfig = {
  name: 'mistralai/mistral-small-3.2-24b-instruct:free',
  apiKey: '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',
  requestCount: 0,
  lastUsed: 0,
  isAvailable: true
};

// 載入均衡統計數據
const loadBalancingStats = {
  totalRequests: parseInt(localStorage.getItem('mathstakes_total_requests') || '0'),
  dailyRequests: parseInt(localStorage.getItem('mathstakes_daily_requests') || '0'),
  lastResetDate: localStorage.getItem('mathstakes_last_reset') || new Date().toDateString()
};

// 智能模型選擇器
const selectOptimalModel = (): ModelConfig => {
  const now = Date.now();
  const currentDate = new Date().toDateString();
  
  // 重置每日統計
  if (loadBalancingStats.lastResetDate !== currentDate) {
    loadBalancingStats.dailyRequests = 0;
    loadBalancingStats.lastResetDate = currentDate;
    localStorage.setItem('mathstakes_daily_requests', '0');
    localStorage.setItem('mathstakes_last_reset', currentDate);
  }
  
  // 更新請求統計
  loadBalancingStats.totalRequests++;
  loadBalancingStats.dailyRequests++;
  localStorage.setItem('mathstakes_total_requests', loadBalancingStats.totalRequests.toString());
  localStorage.setItem('mathstakes_daily_requests', loadBalancingStats.dailyRequests.toString());
  
  // 過濾可用模型
  const availableModels = MODEL_CONFIGS.filter(config => config.isAvailable);
  
  if (availableModels.length === 0) {
    console.warn('沒有可用模型，使用備用配置');
    return BACKUP_CONFIG;
  }
  
  // 智能分散邏輯：根據訪問數量和時間決定使用哪個模型
  let selectedModel: ModelConfig;
  
  if (loadBalancingStats.dailyRequests <= 10) {
    // 前10次請求優先使用第一個模型
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

// 標記模型為不可用
const markModelAsUnavailable = (modelName: string, apiKey: string): void => {
  const config = MODEL_CONFIGS.find(c => c.name === modelName && c.apiKey === apiKey);
  if (config) {
    config.isAvailable = false;
    console.log(`模型 ${modelName} 已標記為不可用`);
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

// 從本地存儲或智能選擇API配置
const getOptimalAPIConfig = (): { apiKey: string; model: string } => {
  // 優先使用用戶設置的金鑰
  const localApiKey = localStorage.getItem('mathstakes_api_key');
  if (localApiKey && localApiKey.startsWith('sk-or-')) {
    console.log('使用用戶設置的API金鑰');
    return {
      apiKey: localApiKey,
      model: 'mistralai/mistral-small-3.2-24b-instruct:free' // 用戶設置時默認使用第一個模型
    };
  }
  
  // 使用智能負載均衡選擇
  const selectedConfig = selectOptimalModel();
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
  try {
    // 顯示處理中的提示
    const toastId = toast.loading('正在識別圖片中的題目...');
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
    
    // 獲取API金鑰
    const { apiKey, model } = getOptimalAPIConfig();
    
    // 記錄API金鑰信息（不顯示完整金鑰）
    console.log('API設置確認:', {
      apiKey: apiKey ? `${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}` : '未設置',
      model: model
    });
    
    // 構建系統提示詞
    const systemPrompt = `
      你是一個專門處理數學題目的AI助手。你的任務是提取圖片中數學題目的文字內容，不需要解答或分析題目。
      請只識別以下信息：
      1. 標題 - 簡短的題目描述（不超過15字）
      2. 內容 - 完整的題目文字，包括所有條件和問題，保留原始格式
      3. 學科 - 數學分支，如代數、幾何、微積分等
      
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
    
    // 構建用戶提示詞，包括圖片URL
    const userMessage = `請識別這張數學題目的圖片內容並按格式回答`;
    
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
    
    // 記錄API請求開始
    console.log(`開始API請求 (模型: ${model})`);
    console.log('發送API請求到:', API_BASE_URL);
    console.log('請求頭部包含Authorization:', apiKey ? '是' : '否');
    console.log('完整請求內容(不含金鑰):', JSON.stringify(requestBody));
    
    // 使用重試機制包裝 API 請求
    const response = await withRetry(
      async () => {
        try {
          const fetchResponse = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Mathstakes App',
              'User-Agent': 'Mathstakes-App/1.0'
            },
            body: JSON.stringify(requestBody),
          });
          
          if (!fetchResponse.ok) {
            const errorData = await fetchResponse.json().catch(() => ({}));
            const errorMessage = `API請求失敗: ${fetchResponse.status} - ${JSON.stringify(errorData)}`;
            console.error(errorMessage);
            console.error('詳細請求信息:', { 
              status: fetchResponse.status, 
              statusText: fetchResponse.statusText,
              headers: [...fetchResponse.headers.entries()].reduce((acc, [key, val]) => ({...acc, [key]: val}), {})
            });
            
            // 如果是401錯誤，直接拋出錯誤
            if (fetchResponse.status === 401) {
              throw new Error('API金鑰認證失敗，請檢查API金鑰設置');
            }
            
            throw new Error(errorMessage);
          }
          
          return await fetchResponse.json();
        } catch (error) {
          console.error('API請求出錯:', error);
          throw error;
        }
      },
      { maxRetries: AI_CONFIG.maxRetries, retryDelay: AI_CONFIG.retryDelay }
    );
    
    // 解析響應
    const data = await response;
    
    // 檢查是否有回答
    if (!data.choices || data.choices.length === 0) {
      toast.dismiss(toastId);
      toast.error('AI無法識別圖片內容，請重試或手動輸入');
      throw new Error('API回應未包含有效內容');
    }

    // 獲取 AI 回答的文本內容
    const aiResponse = data.choices[0].message.content;
    console.log('AI回應:', aiResponse);
    
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
        educationLevel: EducationLevel.JUNIOR, // 設置默認值
        errorType: ErrorType.UNKNOWN // 設置默認值
      };
    } catch (error) {
      console.error('JSON解析錯誤:', error, 'AI回應:', aiResponse);
      toast.dismiss(toastId);
      toast.error('無法解析AI回應，請重試或手動輸入');
      
      // 返回預設值
      return {
        title: '未能識別題目',
        content: aiResponse, // 直接使用 AI 的原始回應作為內容
        subject: '數學',
        errorType: ErrorType.UNKNOWN
      };
    }
  } catch (error) {
    console.error('圖片識別失敗:', error);
    toast.dismiss(); // 確保所有載入提示都已關閉
    
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
  try {
    // 顯示加載提示
    const toastId = toast.loading('正在生成AI解釋...');
    
    // 獲取最佳API配置
    const { apiKey, model } = getOptimalAPIConfig();
    
    console.log(`開始生成AI解釋 (模型: ${model}, 金鑰: ${apiKey.substring(0, 8)}...)`);
    
    // 構建系統提示詞 - 簡化判斷邏輯
    const systemPrompt = `你是一位專業數學教師，擅長分析學生的錯題並提供詳細解釋。請針對學生提交的題目，分析可能存在的錯誤，提供完整的解題步驟，並給出學習建議。回答要清晰、準確、易於理解，適合${mistake.educationLevel}學生的認知水平。請使用繁體中文回答，數學公式請使用LaTeX格式（例如：$x^2 + y^2 = r^2$）。`;
    
    // 構建用戶提示詞 - 簡化內容
    const userPrompt = `
      請分析以下數學錯題：
      
      題目: ${mistake.title}
      內容: ${mistake.content}
      學科: ${mistake.subject}
      教育階段: ${mistake.educationLevel}
      
      請提供以下內容:
      1. 錯誤分析 - 這類題目學生常見的錯誤
      2. 解題步驟 - 完整、清晰的解題步驟
      3. 知識點解釋 - 與題目相關的重要數學概念
      4. 學習建議 - 如何避免類似錯誤並提高相關數學能力
      
      請使用繁體中文回答，注意數學公式請使用LaTeX格式。請保證內容通俗易懂，適合${mistake.educationLevel}學生理解。
    `;
    
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
    
    console.log('開始發送AI解釋請求', new Date().toISOString());
    console.log('請求體:', JSON.stringify({
      model: requestBody.model,
      temperature: requestBody.temperature,
      max_tokens: requestBody.max_tokens,
      messagesCount: requestBody.messages.length
    }));
    
    // 簡化API請求，直接發送請求不使用重試機制
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Mathstakes App',
        'User-Agent': 'Mathstakes-App/1.0'
      },
      body: JSON.stringify(requestBody)
    });
      
    // 檢查響應
    if (!response.ok) {
        toast.dismiss(toastId);
        toast.error('AI服務暫時不可用，請稍後重試');
        
        // 返回一個預設的解釋模板
        return `
### ${mistake.title} - 解題分析

#### 錯誤分析
這類題目學生常見的錯誤包括：
- 混淆概念或公式
- 計算過程中出錯
- 理解題目條件不完整
- 錯誤應用數學原理

#### 解題步驟
針對題目：${mistake.content}

我們應該按照以下步驟解答：
1. 仔細閱讀並理解題目條件
2. 確定使用的數學方法和公式
3. 根據條件進行運算
4. 得出結論並檢查答案

#### 知識點解釋
本題涉及的主要知識點包括：
- ${mistake.subject}相關概念
- 解題思路和方法
- 計算技巧和注意事項

#### 學習建議
- 加強基礎概念的理解
- 多做類似題目練習
- 學會檢查自己的答案
- 總結解題方法和技巧
        `;
    }
    
    // 第一個金鑰成功的情況
    const data = await response.json();
    
    // 獲取 AI 回答的文本內容
    const content = data.choices[0].message.content;
    
    // 如果內容為空，返回模板
    if (!content || content.trim() === '') {
      toast.dismiss(toastId);
      toast.error('AI未能生成有效解釋');
      
      // 返回一個預設模板
      return `
### ${mistake.title} - 解題分析

#### 錯誤分析
這類題目學生常見的錯誤包括：
- 混淆概念或公式
- 計算過程中出錯
- 理解題目條件不完整
- 錯誤應用數學原理

#### 解題步驟
針對題目：${mistake.content}

我們應該按照以下步驟解答：
1. 仔細閱讀並理解題目條件
2. 確定使用的數學方法和公式
3. 根據條件進行運算
4. 得出結論並檢查答案

#### 知識點解釋
本題涉及的主要知識點包括：
- ${mistake.subject}相關概念
- 解題思路和方法
- 計算技巧和注意事項

#### 學習建議
- 加強基礎概念的理解
- 多做類似題目練習
- 學會檢查自己的答案
- 總結解題方法和技巧
      `;
    }
    
    // 成功獲取內容
    console.log('AI解釋生成成功', new Date().toISOString());
    toast.dismiss(toastId);
    toast.success('AI解釋生成成功');
    
    // 使用格式化工具處理回應內容，包括簡繁轉換和數學公式處理
    return processAIResponse(content);
    
  } catch (error) {
    console.error('生成AI解釋出錯:', error);
    toast.dismiss();
    toast.error('生成AI解釋時發生錯誤');
    
    // 返回一個友好的錯誤消息而不是拋出錯誤
    return `
### 錯誤提示

在生成AI解釋時遇到了技術問題。請稍後再試，或者您可以嘗試手動分析這道題目。

### 題目信息
- 標題: ${mistake.title}
- 內容: ${mistake.content}
- 學科: ${mistake.subject}
    `;
  }
}; 