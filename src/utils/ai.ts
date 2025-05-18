import { Mistake, EducationLevel, TopicCategory, ErrorType } from '../types';
import { withRetry, isOnline } from './networkRetry';
import { toast } from 'react-hot-toast';
import { getApiConfig, markApiKeyAsInvalid } from './apiKeyManager';
import { processAIResponse } from './formulaFormatter';

// AI 配置
const AI_CONFIG = {
  responseTimeout: 60000, // 60秒超時
  maxRetries: 3,
  retryDelay: 1000,
  modelName: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || 'anthropic/claude-3-opus:beta',
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

// 處理API請求錯誤
const handleApiError = (error: any): Error => {
  console.error('API請求錯誤:', error);
  
  // 解析錯誤信息
  let errorMessage = '請求AI服務時發生錯誤';
  let shouldInvalidateKey = false;
  let apiKey = '';
  
  if (error.config && error.config.headers && error.config.headers.Authorization) {
    apiKey = error.config.headers.Authorization.replace('Bearer ', '');
  }
  
  if (error.response) {
    // 服務器返回了錯誤狀態碼
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 401 || status === 403) {
      errorMessage = '無法連接到AI服務：API金鑰無效';
      shouldInvalidateKey = true;
    } else if (status === 429) {
      errorMessage = 'AI服務請求次數已達上限，請稍後再試';
      shouldInvalidateKey = true;
    } else if (data && data.error) {
      errorMessage = `AI服務錯誤: ${data.error}`;
    }
  } else if (error.request) {
    // 請求已發送但沒有收到響應
    errorMessage = '無法連接到AI服務，請檢查網絡連接';
  }
  
  // 如果需要，標記當前 API 金鑰為無效
  if (shouldInvalidateKey && apiKey) {
    markApiKeyAsInvalid(apiKey);
    console.warn(`已標記API金鑰為無效: ${apiKey.substring(0, 10)}...`);
  }
  
  return new Error(errorMessage);
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

// 使用 Llama API 從圖片生成題目資訊
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
    
    // 獲取 API 配置
    const apiConfig = getApiConfig();
    if (!apiConfig.apiKey) {
      toast.dismiss(toastId);
      toast.error('未找到有效的API金鑰');
      throw new Error('未找到有效的API金鑰');
    }
    
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
      model: AI_CONFIG.modelName,
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
    console.log(`開始API請求 (模型: ${AI_CONFIG.modelName}, 金鑰: ${apiConfig.apiKey.substring(0, 10)}...)`);
    
    // 使用重試機制包裝 API 請求
    const response = await withRetry(
      async () => {
        // 確保每次重試使用最新的API金鑰
        const latestConfig = getApiConfig();
        
        // 原始 API 請求代碼
        const response = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${latestConfig.apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Mathstakes',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mathstakes Education App',
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // 檢查是否為 API 金鑰無效
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            markApiKeyAsInvalid(latestConfig.apiKey);
            console.warn(`API請求失敗 (狀態碼: ${response.status})，已標記金鑰 ${latestConfig.apiKey.substring(0, 10)}... 為無效`);
          }
          
          throw new Error(`API請求失敗: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        return response;
      },
      {
        maxRetries: AI_CONFIG.maxRetries,
        retryDelay: AI_CONFIG.retryDelay
      }
    );

    // 解析響應
    const data = await response.json();
    
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
    // 檢查網絡連接
    if (!isOnline()) {
      toast.error('您目前處於離線狀態，無法生成AI解釋');
      throw new Error('網絡離線，無法生成AI解釋');
    }
    
    // 獲取 API 配置
    const apiConfig = getApiConfig();
    if (!apiConfig.apiKey) {
      toast.error('未找到有效的API金鑰');
      throw new Error('未找到有效的API金鑰');
    }
    
    // 檢查是否包含自定義問題
    const hasCustomQuestions = mistake.explanation && (
      mistake.explanation.includes('正確答案') || 
      mistake.explanation.includes('常犯錯誤') || 
      mistake.explanation.includes('避免') || 
      mistake.explanation.includes('建議')
    );
    
    // 構建系統提示詞
    const systemPrompt = hasCustomQuestions
      ? `你是一位專業數學教師，擅長分析學生的錯題並提供針對性指導。現在有學生提出了具體問題，請根據題目內容，直接回答這些問題。回答要清晰、準確、易於理解，適合${mistake.educationLevel}學生的認知水平。請使用繁體中文回答，數學公式請使用LaTeX格式（例如：$x^2 + y^2 = r^2$）。`
      : `你是一位專業數學教師，擅長分析學生的錯題並提供詳細解釋。請針對學生提交的題目，分析可能存在的錯誤，提供完整的解題步驟，並給出學習建議。回答要清晰、準確、易於理解，適合${mistake.educationLevel}學生的認知水平。請使用繁體中文回答，數學公式請使用LaTeX格式（例如：$x^2 + y^2 = r^2$）。`;
    
    // 構建用戶提示詞
    const errorTypeText = mistake.errorType ? `錯誤類型: ${mistake.errorType}` : '';
    const errorStepsText = mistake.errorSteps ? `\n\n學生的錯誤步驟: ${mistake.errorSteps}` : '';
    const userAnswerText = mistake.userAnswer ? `\n\n學生的錯誤答案: ${mistake.userAnswer}` : '';
    const questionText = mistake.explanation || '';
    
    let userPrompt;
    
    if (hasCustomQuestions) {
      userPrompt = `
        我需要你回答關於以下數學題目的具體問題：
        
        題目: ${mistake.title}
        內容: ${mistake.content}
        學科: ${mistake.subject}
        教育階段: ${mistake.educationLevel}
        ${errorTypeText}
        ${errorStepsText}
        ${userAnswerText}
        
        我的問題是:
        ${questionText}
        
        請直接回答上述問題，使用繁體中文，注意數學公式請使用LaTeX格式，例如角度可表示為 $35^\\circ$，分數表示為 $\\frac{1}{2}$，方程式可表示為 $x^2 + 2x + 1 = 0$。請保證內容通俗易懂，適合學生理解。
      `;
    } else {
      userPrompt = `
      請分析以下數學錯題：
      
      題目: ${mistake.title}
      內容: ${mistake.content}
      學科: ${mistake.subject}
      教育階段: ${mistake.educationLevel}
      ${errorTypeText}
      ${errorStepsText}
      ${userAnswerText}
      
      請提供以下內容:
        1. 錯誤分析 - 這類題目學生常見的錯誤
      2. 解題步驟 - 完整、清晰的解題步驟
        3. 知識點解釋 - 與題目相關的重要數學概念
      4. 學習建議 - 如何避免類似錯誤並提高相關數學能力
      
        請使用繁體中文回答，注意數學公式請使用LaTeX格式，例如角度可表示為 $35^\\circ$，分數表示為 $\\frac{1}{2}$，方程式可表示為 $x^2 + 2x + 1 = 0$。請保證內容通俗易懂，適合${mistake.educationLevel}學生理解。
    `;
    }
    
    // 構建請求體
    const requestBody = {
      model: AI_CONFIG.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.max_tokens
    };
    
    console.log(`開始生成AI解釋 (模型: ${AI_CONFIG.modelName}, 金鑰: ${apiConfig.apiKey.substring(0, 10)}...)`);
    
    // 使用重試機制包裝 API 請求
    const response = await withRetry(
      async () => {
        // 確保每次重試使用最新的API金鑰
        const latestConfig = getApiConfig();
        
        console.log('開始發送AI解釋請求', new Date().toISOString());
        const response = await fetch(API_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${latestConfig.apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Mathstakes',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Mathstakes Education App',
            'Accept': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // 檢查是否為 API 金鑰無效
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            markApiKeyAsInvalid(latestConfig.apiKey);
            console.warn(`API請求失敗 (狀態碼: ${response.status})，已標記金鑰 ${latestConfig.apiKey.substring(0, 10)}... 為無效`);
          }
          
          throw new Error(`API請求失敗: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        return response;
      },
      {
        maxRetries: AI_CONFIG.maxRetries,
        retryDelay: AI_CONFIG.retryDelay
      }
    );
    
    // 處理響應
    const data = await response.json();
    
    // 檢查是否有回答
    if (!data.choices || data.choices.length === 0) {
      throw new Error('API回應未包含有效內容');
    }
    
    // 獲取 AI 回答的文本內容
    const content = data.choices[0].message.content;
    if (!content) {
      throw handleApiError(new Error('API 返回內容為空'));
    }
    
    console.log('AI解釋生成成功', new Date().toISOString());
    
    // 使用格式化工具處理回應內容，包括簡繁轉換和數學公式處理
    const processedContent = processAIResponse(content);
    
    return processedContent;
  } catch (error) {
    console.error('生成解釋出錯:', error);
    throw error;
  }
}; 