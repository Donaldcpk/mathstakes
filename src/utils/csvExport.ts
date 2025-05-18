import { Mistake } from '../types';
import { formatDate } from './helpers';

/**
 * 將錯題數據轉換為 CSV 格式字符串
 * @param mistakes 要導出的錯題數組
 * @returns CSV 格式的字符串
 */
export const mistakesToCSVString = (mistakes: Mistake[]): string => {
  if (!mistakes || mistakes.length === 0) {
    return '';
  }

  // 定義標題行 - 確保與匯入格式一致
  const headers = [
    'title',
    'content',
    'subject',
    'educationLevel',
    'errorType',
    'explanation',
    'createdAt',
    'lastReviewedAt'
  ];

  // 拼接標題行
  let csvContent = headers.join(',') + '\n';

  // 添加數據行
  mistakes.forEach(mistake => {
    const row = headers.map(header => {
      // 獲取當前欄位的值
      const value = mistake[header as keyof Mistake];
      
      // 處理特殊字符：如果內容包含逗號、雙引號或換行符，則需要用雙引號包裹
      if (value === null || value === undefined) {
        return '';
      }
      
      let cellValue = String(value);
      if (header === 'createdAt' || header === 'lastReviewedAt') {
        cellValue = value ? formatDate(value as string) : '';
      }
      
      // 如果包含特殊字符，使用雙引號包裹，並將內部的雙引號替換為兩個雙引號
      if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
        return `"${cellValue.replace(/"/g, '""')}"`;
      }
      return cellValue;
    });
    
    csvContent += row.join(',') + '\n';
  });

  return csvContent;
};

/**
 * 將錯題數據導出為 CSV 文件並觸發下載
 * @param mistakes 要導出的錯題數組
 * @param filename 下載文件的名稱（默認為 mistakes_export_年月日.csv）
 */
export const exportToCSV = (
  mistakes: Mistake[], 
  filename?: string
): void => {
  if (!mistakes || mistakes.length === 0) {
    alert('沒有錯題數據可供導出');
    return;
  }
  
  // 生成 CSV 內容
  const csvContent = mistakesToCSVString(mistakes);
  
  // 創建 Blob 對象
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // 創建下載鏈接
  const url = URL.createObjectURL(blob);
  
  // 創建一個臨時 <a> 元素用於下載
  const link = document.createElement('a');
  link.setAttribute('href', url);
  
  // 設置文件名
  if (!filename) {
    const date = new Date();
    const formattedDate = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    filename = `mistakes_export_${formattedDate}.csv`;
  }
  
  link.setAttribute('download', filename);
  
  // 添加到 DOM、觸發點擊、然後移除
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // 釋放 URL 對象
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}; 