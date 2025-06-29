import { Mistake } from '../types';
import { bulkSaveMistakes } from './storage';

/**
 * 驗證 CSV 格式是否符合要求
 * @param headers CSV 的標題行
 * @returns 是否符合要求
 */
export const validateCSVFormat = (headers: string[]): boolean => {
  // 定義必需的標題欄位
  const requiredHeaders = ['title', 'content', 'subject', 'educationLevel'];
  
  // 檢查所有必需欄位是否存在
  return requiredHeaders.every(header => headers.includes(header));
};

/**
 * 標準化 CSV 欄位名稱，處理字段名稱不一致的情況
 * @param headers CSV 的標題行
 * @returns 標準化後的標題行
 */
const normalizeHeaders = (headers: string[]): string[] => {
  return headers.map(header => {
    // 檢查是否需要替換舊的 'description' 欄位為 'explanation'
    if (header === 'description') {
      return 'explanation';
    }
    return header;
  });
};

/**
 * 解析 CSV 數據字符串
 * @param csvData CSV 格式的字符串
 * @returns 解析後的錯題對象數組和錯誤信息
 */
export const parseCSVData = (csvData: string): { mistakes: Partial<Mistake>[], errors: string[] } => {
  const errors: string[] = [];
  const mistakes: Partial<Mistake>[] = [];
  
  try {
    console.log('開始解析CSV數據...');
    
    // 檢查數據是否為空
    if (!csvData || csvData.trim() === '') {
      errors.push('CSV 數據為空');
      return { mistakes, errors };
    }
    
    // 確保輸入數據使用正確的編碼
    // 檢測並處理BOM標記
    let cleanedData = csvData;
    if (csvData.charCodeAt(0) === 0xFEFF) {
      cleanedData = csvData.slice(1);
      console.log('已移除UTF-8 BOM標記');
    }
    
    // 分割行（考慮到引號中可能有換行符）
    const lines = parseCSVLines(cleanedData);
    
    if (lines.length === 0) {
      errors.push('CSV 文件為空或格式不正確');
      return { mistakes, errors };
    }
    
    if (lines.length === 1) {
      errors.push('CSV 文件只有標題行，沒有實際數據');
      return { mistakes, errors };
    }
    
    // 第一行是標題
    let headers = parseCsvRow(lines[0]);
    
    // 記錄原始標題以便調試
    console.log('原始CSV標題:', headers);
    
    // 標準化標題欄位名稱
    headers = normalizeHeaders(headers);
    
    // 驗證標題格式
    if (!validateCSVFormat(headers)) {
      errors.push('CSV 格式不正確。必須包含 title, content, subject, educationLevel 欄位');
      console.error('標題格式驗證失敗:', headers);
      return { mistakes, errors };
    }
    
    // 處理每一行數據
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        console.log(`跳過第 ${i + 1} 行: 空行`);
        continue; // 跳過空行
      }
      
      try {
      const values = parseCsvRow(line);
      
        // 處理行尾可能多出的空值
        while (values.length > headers.length && values[values.length - 1] === '') {
          values.pop();
        }
        
        // 如果欄位數量不匹配，但差距不大，嘗試修正
      if (values.length !== headers.length) {
          console.warn(`第 ${i + 1} 行欄位數量不匹配：預期 ${headers.length} 個欄位，實際有 ${values.length} 個欄位`);
          
          // 如果欄位太少，添加空值
          while (values.length < headers.length) {
            values.push('');
          }
          
          // 如果欄位太多，截斷
          if (values.length > headers.length) {
            values.length = headers.length;
          }
      }
      
      const mistake: Partial<Mistake> = {};
        let hasMandatoryFields = true;
      
      // 將每個欄位的值添加到錯題對象中
      headers.forEach((header, index) => {
          let value = values[index];
          
          // 清理值
          if (value !== undefined && value !== null) {
            // 去除前後空格
            value = value.trim();
            
            // 檢查標題、內容、學科這三個必填欄位是否為空
            if ((header === 'title' || header === 'content' || header === 'subject') && !value) {
              hasMandatoryFields = false;
              console.warn(`第 ${i + 1} 行缺少必填欄位: ${header}`);
            }
            
            if (value !== '') {
          // @ts-ignore - 動態屬性賦值
              mistake[header] = value;
            }
        }
      });
      
      // 檢查必需欄位
        if (!hasMandatoryFields) {
          errors.push(`第 ${i + 1} 行缺少必需欄位(title, content, subject)`);
        continue;
      }
      
      // 添加當前時間戳如果不存在
      if (!mistake.createdAt) {
        const now = new Date().toISOString();
        mistake.createdAt = now;
      }
        
        // 確保空的lastReviewedAt欄位不會破壞匯入
        if (mistake.lastReviewedAt === undefined || mistake.lastReviewedAt === '') {
          mistake.lastReviewedAt = '';
        }
      
      mistakes.push(mistake);
        console.log(`成功解析第 ${i + 1} 行數據`);
      } catch (lineError) {
        console.error(`解析第 ${i + 1} 行出錯:`, lineError);
        errors.push(`第 ${i + 1} 行解析失敗: ${(lineError as Error).message}`);
      }
    }
    
    console.log(`CSV 解析完成：${mistakes.length} 條記錄，${errors.length} 個錯誤`);
    
  } catch (error) {
    console.error('解析 CSV 出錯:', error);
    errors.push(`解析 CSV 出錯：${(error as Error).message}`);
  }
  
  return { mistakes, errors };
};

/**
 * 解析 CSV 行，處理引號內的換行符
 * @param csvData CSV 數據字符串
 * @returns 解析後的行數組
 */
function parseCSVLines(csvData: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let insideQuotes = false;
  
  for (let i = 0; i < csvData.length; i++) {
    const char = csvData[i];
    const nextChar = i < csvData.length - 1 ? csvData[i + 1] : '';
    
    // 處理引號
    if (char === '"') {
      // 檢查是否為轉義引號 ("")
      if (nextChar === '"') {
        currentLine += '"';
        i++; // 跳過下一個引號
      } else {
        // 切換引號狀態
        insideQuotes = !insideQuotes;
        currentLine += char;
      }
    }
    // 處理換行符
    else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // 跳過 \n
      }
      lines.push(currentLine);
      currentLine = '';
    }
    // 其他字符
    else {
      currentLine += char;
    }
  }
  
  // 添加最後一行
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * 解析 CSV 行中的欄位
 * @param line CSV 行文本
 * @returns 解析後的欄位值數組
 */
function parseCsvRow(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : '';
    
    // 處理引號
    if (char === '"') {
      // 檢查是否為轉義引號 ("")
      if (nextChar === '"') {
        currentValue += '"';
        i++; // 跳過下一個引號
      } else {
        // 切換引號狀態
        insideQuotes = !insideQuotes;
      }
    }
    // 處理逗號分隔符
    else if (char === ',' && !insideQuotes) {
      values.push(currentValue);
      currentValue = '';
    }
    // 其他字符
    else {
      currentValue += char;
    }
  }
  
  // 添加最後一個值
  values.push(currentValue);
  
  // 清理欄位中的引號
  return values.map(value => {
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.substring(1, value.length - 1).replace(/""/g, '"');
    }
    return value;
  });
}

/**
 * 從 CSV 匯入錯題
 * @param csvData CSV 格式的字符串
 * @returns 匯入結果，包含成功數量和錯誤信息
 */
export const importMistakesFromCSV = async (
  csvData: string
): Promise<{ success: boolean; importedCount: number; errors: string[] }> => {
  const { mistakes, errors } = parseCSVData(csvData);
  
  if (errors.length > 0 && mistakes.length === 0) {
    return { success: false, importedCount: 0, errors };
  }
  
  try {
    // 使用 bulkSaveMistakes 批量保存錯題
    const result = await bulkSaveMistakes(mistakes);
    
    return {
      success: result.success,
      importedCount: result.importedCount,
      errors: [...errors, ...result.errors]
    };
  } catch (error) {
    return {
      success: false,
      importedCount: 0,
      errors: [...errors, `匯入過程中發生錯誤: ${(error as Error).message}`]
    };
  }
}; 