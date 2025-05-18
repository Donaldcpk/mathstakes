import { Mistake } from '../types';
import { formatDate } from './helpers';

/**
 * 將錯題數據匯出為 Excel（CSV 格式）
 * @param mistakes 要導出的錯題數組
 * @param filename 下載文件的名稱（可選）
 */
export const exportToExcel = (mistakes: Mistake[], filename?: string): void => {
  if (!mistakes || mistakes.length === 0) {
    console.warn('沒有錯題數據可供導出');
    return;
  }

  try {
    // 定義標題行（中文顯示）
    const headers = [
      '錯題ID',
      '標題',
      '問題內容',
      '科目',
      '教育階段',
      '錯誤類型',
      '描述',
      '創建日期',
      '最後複習日期',
      'AI解釋'
    ];

    // 定義對應的數據字段
    const fields: (keyof Mistake)[] = [
      'id',
      'title',
      'content',
      'subject',
      'educationLevel',
      'errorType',
      'description',
      'createdAt',
      'lastReviewedAt',
      'aiExplanation'
    ];

    // 構建數據行
    const rows = mistakes.map(mistake => {
      return fields.map(field => {
        let value = mistake[field];
        
        // 格式化日期字段
        if (field === 'createdAt' || field === 'lastReviewedAt') {
          value = value ? formatDate(value as string) : '';
        }
        
        // 處理空值
        if (value === null || value === undefined) {
          return '';
        }
        
        // 轉換為字符串並處理特殊字符
        const strValue = String(value);
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        
        return strValue;
      });
    });

    // 構建 CSV 內容
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // 創建 Blob 對象
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // 創建臨時下載連結
    const link = document.createElement('a');
    
    // 設置文件名
    if (!filename) {
      const date = new Date();
      const formattedDate = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
      filename = `mistakes_excel_${formattedDate}.csv`;
    }
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    
    // 觸發下載並清理
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 釋放 URL 對象
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('匯出到 Excel 失敗:', error);
    throw new Error(`匯出到 Excel 失敗: ${(error as Error).message}`);
  }
}; 