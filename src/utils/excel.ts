import * as XLSX from 'xlsx';
import { Mistake } from '../types';

export const exportToExcel = (mistakes: Mistake[]): void => {
  // 準備數據
  const worksheetData = mistakes.map(mistake => ({
    '標題': mistake.title,
    '題目內容': mistake.content,
    '科目': mistake.subject,
    '錯誤類型': mistake.errorType,
    '日期': new Date(mistake.createdAt).toLocaleDateString(),
    'AI 解釋': mistake.explanation || '暫無解釋'
  }));

  // 創建工作表
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // 設置列寬
  const columnWidths = [
    { wch: 20 }, // 標題
    { wch: 40 }, // 題目內容
    { wch: 15 }, // 科目
    { wch: 15 }, // 錯誤類型
    { wch: 15 }, // 日期
    { wch: 60 }  // AI 解釋
  ];
  worksheet['!cols'] = columnWidths;

  // 創建工作簿
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '數學錯題');

  // 生成文件名
  const fileName = `數學錯題本_${new Date().toISOString().slice(0, 10)}.xlsx`;

  // 下載文件
  XLSX.writeFile(workbook, fileName);
}; 