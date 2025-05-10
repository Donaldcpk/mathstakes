import { Mistake, EducationLevel, TopicCategory, ErrorType } from '../types';
import { withRetry, isOnline } from './networkRetry';
import { toast } from 'react-hot-toast';

// AI 配置
const AI_CONFIG = {
  responseTimeout: 60000, // 60秒超時
  maxRetries: 3,
  modelName: 'meta-llama/llama-4-maverick:free',
  temperature: 0.7,
  max_tokens: 8000, // 修正參數名稱為max_tokens
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

// 獲取 API 密鑰 - 使用固定密鑰
const getApiConfig = () => {
  return {
    useProxy: false,
    apiKey: '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'
  };
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
    console.log('開始處理圖片識別請求', new Date().toISOString());
    
    // 檢查網絡連接
    if (!isOnline()) {
      toast.error('您目前處於離線狀態，無法進行圖片識別');
      console.error('處於離線狀態，無法進行圖片識別');
      throw new Error('網絡離線，無法進行圖片識別');
    }

    // 驗證圖片URL是否有效
    if (!imageUrl || !(await isValidImageUrl(imageUrl))) {
      throw handleApiError(new Error('圖片格式無效或URL無法訪問'));
    }
    
    // 獲取 API 配置
    const apiConfig = getApiConfig();
    
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
      - 不要使用反引號或markdown標記
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
    
    // 使用重試機制包裝 API 請求
    const response = await withRetry(
      async () => {
        // 原始 API 請求代碼
        const response = await fetch(API_BASE_URL, {
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
      // 嘗試清理可能的markdown格式，如果內容包含反引號或Markdown標記
      let cleanContent = content;
      
      // 移除markdown代碼塊標記
      if (cleanContent.includes('```')) {
        cleanContent = cleanContent.replace(/```json\s*/, '').replace(/```\s*$/, '');
        // 進一步清理任何代碼塊
        cleanContent = cleanContent.replace(/```[\s\S]*?```/g, '').trim();
      }
      
      // 嘗試解析JSON
      try {
        result = JSON.parse(cleanContent);
      } catch (innerError) {
        // 如果第一次清理失敗，嘗試使用正則表達式提取JSON物件
        const jsonMatch = content.match(/{[\s\S]*?}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw innerError;
        }
      }
    } catch (e) {
      console.error('JSON解析錯誤，原始內容:', content);
      console.error('具體解析錯誤:', e);
      // 提供更詳細的錯誤訊息
      let detailedError = '返回數據格式異常，無法解析JSON';
      
      // 檢查是否包含常見的問題模式
      if (content.includes('```')) {
        detailedError += '。數據可能包含markdown格式標記';
      } else if (content.includes('\n')) {
        detailedError += '。數據包含換行符';
      } else if (content.includes('\\"') || content.includes('\\\\"')) {
        detailedError += '。數據包含多重轉義字符';
      }
      
      // 添加額外診斷資訊
      detailedError += '。系統已嘗試自動修正，但仍然失敗。';
      
      throw handleApiError(new Error(detailedError));
    }
    
    // 驗證和清理結果
    if (!result.title || !result.content || !result.subject) {
      throw handleApiError(new Error('內容識別不完整，請確保圖片清晰可讀'));
    }
    
    // 返回結果
    return {
      title: result.title,
      content: result.content,
      subject: result.subject
    };
  } catch (error) {
    console.error('生成題目信息出錯:', error);
    throw error;
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
    
    // 檢查是否包含自定義問題
    const hasCustomQuestions = mistake.explanation && (
      mistake.explanation.includes('正確答案') || 
      mistake.explanation.includes('常犯錯誤') || 
      mistake.explanation.includes('避免') || 
      mistake.explanation.includes('建議')
    );
    
    // 構建系統提示詞
    const systemPrompt = hasCustomQuestions
      ? `你是一位專業數學教師，擅長分析學生的錯題並提供針對性指導。現在有學生提出了具體問題，請根據題目內容，直接回答這些問題。回答要清晰、準確、易於理解，適合${mistake.educationLevel}學生的認知水平。`
      : `你是一位專業數學教師，擅長分析學生的錯題並提供詳細解釋。請針對學生提交的題目，分析可能存在的錯誤，提供完整的解題步驟，並給出學習建議。回答要清晰、準確、易於理解，適合${mistake.educationLevel}學生的認知水平。`;
    
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
        
        請直接回答上述問題，避免使用複雜的數學符號，使用通俗易懂的語言解釋。不需要重複題目內容或做其他額外的解釋。
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
        
        請使用清晰易懂的語言，適合${mistake.educationLevel}學生理解。避免使用複雜的數學符號表示法。
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
    
    // 使用重試機制包裝 API 請求
    const response = await withRetry(
      async () => {
        console.log('開始發送AI解釋請求', new Date().toISOString());
        const response = await fetch(API_BASE_URL, {
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
        timeout: 60000,
        onRetry: (attempt, error) => {
          console.log(`AI解釋請求重試 (${attempt})，錯誤:`, error);
        }
      }
    );
    
    // 處理響應
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw handleApiError(new Error('API 返回內容為空'));
    }
    
    console.log('AI解釋生成成功', new Date().toISOString());
    return content;
  } catch (error) {
    console.error('生成解釋出錯:', error);
    throw error;
  }
}; 