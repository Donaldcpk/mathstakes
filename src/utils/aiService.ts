import OpenAI from 'openai';
import { getOpenAIAPIKey } from './services/settingsService';
import { Mistake, MistakeFormData } from '../types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * 生成AI解釋
 */
export const generateAIExplanation = async (
  mistake: Mistake | MistakeFormData
): Promise<string> => {
  try {
    // 首先檢查是否有API Key
    const apiKey = await getOpenAIAPIKey();
    if (!apiKey) {
      throw new Error('缺少API密鑰，請在設置中配置OpenAI API密鑰');
    }

    console.log('生成AI解釋的數據:', mistake);

    // 構建提示詞 
    let prompt = `你是一位數學教師，專門幫助學生理解和解決數學問題。
以下是一個學生的錯題，請分析並提供解釋:

題目: ${mistake.content}
${mistake.imageUrl ? '(學生題目有附帶圖片，請分析題目內容並基於圖片信息給出正確答案)' : ''}
科目: ${mistake.subject}
年級/教育階段: ${mistake.educationLevel}
錯誤類型: ${(mistake as Mistake).errorType || '未指定'}
學生的錯誤步驟: ${mistake.errorSteps || '未提供'}
學生的答案: ${mistake.userAnswer || '未提供'}

${mistake.explanation || ''}

請提供以下內容:
1. 這個題目的正確答案和詳細解題步驟，確保計算無誤。請使用清晰的數學符號和步驟說明。
2. 分析學生在此類題目常見的錯誤模式，特別是在"${mistake.subject}"這一課題中，至少指出3個常見的具體錯誤並解釋原因。
3. 提供避免這些錯誤的針對性學習建議，至少3點具體的解題技巧或學習策略，幫助學生掌握這一類型題目。

每個部分請用明確的標題分隔，使用適當的數學符號表示公式。`;

    // 發送請求
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });

    let messages: ChatCompletionMessageParam[] = [
      { 
        role: 'system', 
        content: '你是一位專業的數學教師，擅長解釋數學概念和解題技巧，分析學生的解題錯誤。' 
      },
      { role: 'user', content: prompt }
    ];

    // 發送請求到OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // 使用更強大的模型來處理數學問題
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    // 獲取並返回生成的解釋
    const explanation = response.choices[0].message.content;
    if (!explanation) {
      throw new Error('生成解釋失敗：API返回空內容');
    }

    return explanation;
  } catch (error) {
    console.error('生成AI解釋失敗:', error);
    if (error instanceof Error) {
      throw new Error(`生成AI解釋失敗: ${error.message}`);
    }
    throw new Error('生成AI解釋失敗: 未知錯誤');
  }
}; 