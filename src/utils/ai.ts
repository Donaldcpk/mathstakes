import { Mistake, EducationLevel, TopicCategory, ErrorType } from '../types';
import { withRetry, waitForNetwork, isOnline } from './networkRetry';
import { toast } from 'react-hot-toast';

// AI 配置
const AI_CONFIG = {
  responseTimeout: 60000, // 60秒超時
  maxRetries: 3,
  modelName: 'openai/gpt-4o',
  temperature: 0.7,
  maxTokens: 1000,
  textGeneration: {
    systemPrompt: '你是一位專業的數學老師，正在幫助學生分析他們的數學錯題。請提供清晰、有教育意義的解釋。',
    userPrompt: (mistake: Mistake) => `請分析以下數學錯題：\n\n題目：${mistake.title}\n內容：${mistake.content}\n\n學生在解答中犯了什麼錯誤？請詳細解釋正確的解法，並給出避免類似錯誤的建議。`
  },
  imageRecognition: {
    systemPrompt: '你是一位AI助手，專門處理數學題目圖片。請識別圖片中的數學題目，並提取關鍵信息。',
  }
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

// 處理API請求錯誤
const handleApiError = (error: any): Error => {
  console.error('API請求錯誤:', error);
  
  // 解析錯誤信息
  let errorMessage = '請求AI服務時發生錯誤';
  
  if (error.response) {
    // 服務器返回了錯誤狀態碼
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 401 || status === 403) {
      errorMessage = '無法連接到AI服務：API密鑰無效';
    } else if (status === 429) {
      errorMessage = 'AI服務請求次數已達上限，請稍後再試';
    } else if (data && data.error) {
      errorMessage = `AI服務錯誤: ${data.error}`;
    }
  } else if (error.request) {
    // 請求已發送但沒有收到響應
    errorMessage = '無法連接到AI服務，請檢查網絡連接';
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

// 獲取 API 密鑰 - 優先使用代理，如果設置了前端密鑰也可以直接使用
const getApiConfig = () => {
  // 檢查是否有前端密鑰（不安全但兼容）
  const frontendKeys = [
    import.meta.env.VITE_OPENROUTER_API_KEY_1,
    import.meta.env.VITE_OPENROUTER_API_KEY_2,
    import.meta.env.VITE_OPENROUTER_API_KEY_3
  ].filter(Boolean) as string[];
  
  // 如果有前端密鑰，返回直接調用模式
  if (frontendKeys.length > 0) {
    const randomIndex = Math.floor(Math.random() * frontendKeys.length);
    return {
      useProxy: false,
      apiKey: frontendKeys[randomIndex]
    };
  }
  
  // 否則返回代理模式
  return {
    useProxy: true,
    apiKey: null
  };
};

// 使用 OpenRouter API 從圖片生成題目資訊
export async function generateMistakeInfoFromImage(imageUrl: string): Promise<MistakeInfoResponse | null> {
  try {
    console.log('開始處理圖片識別請求', new Date().toISOString());
    
    // 檢查網絡連接
    if (!isOnline()) {
      toast.error('您目前處於離線狀態，無法進行圖片識別');
      console.error('處於離線狀態，無法進行圖片識別');
      return null;
    }

    // 驗證圖片URL是否有效
    if (!imageUrl || !(await isValidImageUrl(imageUrl))) {
      throw handleApiError(new Error('圖片格式無效或URL無法訪問'));
    }
    
    // 獲取 API 配置
    const apiConfig = getApiConfig();
    
    // 構建系統提示詞
    const systemPrompt = `
      你是一個專門處理數學題目的AI助手。請分析圖片中的數學題目，並提取以下信息：
      1. 標題 - 簡短的題目概述
      2. 內容 - 完整的題目描述，包括所有條件和問題
      3. 學科 - 具體的數學分支，如代數、幾何等
      4. 教育階段 - 判斷是初中還是高中難度
      5. 主題分類 - 如數與代數、幾何與測量等
      
      以JSON格式回答，結構如下：
      {
        "title": "簡短的題目概述",
        "content": "完整的題目描述",
        "subject": "具體數學分支",
        "educationLevel": "初中"或"高中",
        "topicCategory": "主題分類名稱"
      }
      
      請確保你的JSON格式正確，只輸出JSON，不要有其他文字。
    `;
    
    // 構建用戶提示詞，包括圖片URL
    const userMessage = `
      這是一張數學題目的圖片，請識別裡面的內容並按照格式回答：
      ${imageUrl}
    `;
    
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
      maxTokens: AI_CONFIG.maxTokens
    };
    
    // 使用重試機制包裝 API 請求
    const response = await withRetry(
      async () => {
        // 原始 API 請求代碼
        const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Mathstakes'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`API請求失敗: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        return response;
      },
      {
        maxRetries: 2,
        initialDelay: 2000,
        showToast: true,
        timeout: 30000,
        onRetry: (attempt, error) => {
          console.log(`圖片識別請求重試 (${attempt})，錯誤:`, error);
        }
      }
    );
    
    // 處理響應
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw handleApiError(new Error('API 返回內容為空'));
    }
    
    // 解析JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      throw handleApiError(new Error('返回數據格式異常，無法解析JSON'));
    }
    
    // 驗證和清理結果
    if (!result.title || !result.content || !result.subject) {
      throw handleApiError(new Error('內容識別不完整，請確保圖片清晰可讀'));
    }
    
    // 確定教育階段
    let educationLevel = EducationLevel.JUNIOR;
    if (result.educationLevel && result.educationLevel.includes('高中')) {
      educationLevel = EducationLevel.SENIOR;
    }
    
    // 映射主題分類
    const topicCategory = result.topicCategory ? mapTopicCategory(result.topicCategory) : undefined;
    
    // 構建返回結果
    const mistakeInfo = {
      title: result.title,
      content: result.content,
      subject: result.subject,
      educationLevel,
      topicCategory,
      errorType: ErrorType.UNKNOWN,
      imageUrl,
      createdAt: new Date().toISOString()
    };
    
    return mistakeInfo;
  } catch (error) {
    console.error('生成題目信息出錯:', error);
    throw error;
  }
}

// 根據錯題生成AI解釋
export const generateAIExplanation = async (mistake: Mistake): Promise<string> => {
  try {
    // 獲取 API 配置
    const apiConfig = getApiConfig();
    
    // 構建系統提示詞
    const systemPrompt = AI_CONFIG.textGeneration.systemPrompt;
    
    // 構建用戶提示詞
    const errorTypeText = mistake.errorType ? `錯誤類型: ${mistake.errorType}` : '';
    const errorStepsText = mistake.errorSteps ? `\n\n學生的錯誤步驟: ${mistake.errorSteps}` : '';
    const userAnswerText = mistake.userAnswer ? `\n\n學生的錯誤答案: ${mistake.userAnswer}` : '';
    
    const userPrompt = `
      請分析以下數學錯題：
      
      題目: ${mistake.title}
      內容: ${mistake.content}
      學科: ${mistake.subject}
      教育階段: ${mistake.educationLevel}
      ${errorTypeText}
      ${errorStepsText}
      ${userAnswerText}
      
      請提供以下內容:
      1. 錯誤分析 - 學生可能犯了什麼錯誤
      2. 解題步驟 - 完整、清晰的解題步驟
      3. 知識點解釋 - 與錯題相關的重要數學概念
      4. 學習建議 - 如何避免類似錯誤並提高相關數學能力
      
      請使用易於理解的語言，特別適合${mistake.educationLevel}學生理解。
    `;
    
    // 構建請求體
    const requestBody = {
      model: AI_CONFIG.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: AI_CONFIG.temperature,
      maxTokens: AI_CONFIG.maxTokens
    };
    
    // 設置超時
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(handleApiError(new Error('API 請求超時'))), AI_CONFIG.responseTimeout * 1.5); // 解釋生成允許更長時間
    });
    
    let responsePromise;
    
    // 根據配置使用不同的調用方式
    if (apiConfig.useProxy) {
      // 使用代理 API
      responsePromise = fetch('/api/openrouter-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
    } else {
      // 直接調用 API（不安全，僅作為備用）
      responsePromise = fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mathstakes'
        },
        body: JSON.stringify({
          ...requestBody,
          max_tokens: requestBody.maxTokens // 修正字段名
        })
      });
    }
    
    // 等待請求完成或超時
    const response = await Promise.race([responsePromise, timeoutPromise]);
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data.error?.message || `API 錯誤：HTTP ${response.status}`;
      throw handleApiError(new Error(errorMsg));
    }
    
    // 處理響應
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw handleApiError(new Error('API 返回內容為空'));
    }
    
    return content;
  } catch (error) {
    console.error('生成解釋出錯:', error);
    throw error;
  }
}; 