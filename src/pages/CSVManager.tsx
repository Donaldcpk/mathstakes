import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { parse } from 'papaparse';
import { saveNewMistake, getMistakes } from '../utils/storage';
import { ErrorType, EducationLevel, TopicCategory } from '../types';
import { showToast } from '../utils/toast';

const CSVManager: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 處理CSV檔案上傳
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    setIsUploading(true);
    
    // 檢查檔案類型
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('請上傳CSV格式的檔案', 'error');
      setIsUploading(false);
      return;
    }

    // 解析CSV
    parse(file, {
      header: true,
      complete: async (results) => {
        try {
          // 預覽CSV內容
          setPreviewData(results.data);
          setShowPreview(true);
          showToast(`成功解析 ${results.data.length} 筆錯題記錄`, 'success');
        } catch (error) {
          console.error('CSV解析失敗:', error);
          showToast('CSV解析失敗，請確保格式正確', 'error');
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        console.error('CSV解析錯誤:', error);
        showToast('CSV解析錯誤，請確保格式正確', 'error');
        setIsUploading(false);
      }
    });
  };

  // 匯入CSV數據到系統
  const importCSVData = async () => {
    if (previewData.length === 0) {
      showToast('沒有可匯入的數據', 'error');
      return;
    }

    setIsUploading(true);
    let importedCount = 0;
    let errorCount = 0;

    try {
      for (const row of previewData) {
        try {
          // 從CSV行創建錯題對象
          const title = row['題目'] || row['title'] || '';
          const content = row['內容'] || row['content'] || '';
          const subject = row['學科'] || row['subject'] || '';
          const educationLevel = mapEducationLevel(row['教育階段'] || row['educationLevel']);
          const topicCategory = mapTopicCategory(row['主題分類'] || row['topicCategory']);
          const errorType = mapErrorType(row['錯誤類型'] || row['errorType']);
          const explanation = row['AI分析'] || row['explanation'] || '';
          const errorSteps = row['錯誤步驟'] || row['errorSteps'] || '';
          const userAnswer = row['錯誤答案'] || row['userAnswer'] || '';

          // 儲存錯題
          if (title && content) {
            await saveNewMistake({
              title,
              content,
              subject,
              educationLevel,
              topicCategory,
              errorType,
              explanation,
              errorSteps: errorSteps || undefined,
              userAnswer: userAnswer || undefined,
              createdAt: new Date()
            });
            importedCount++;
          } else {
            errorCount++;
          }
        } catch (rowError) {
          console.error('匯入行錯誤:', rowError);
          errorCount++;
        }
      }

      if (importedCount > 0) {
        showToast(`成功匯入 ${importedCount} 筆錯題記錄`, 'success');
        setShowPreview(false);
        setPreviewData([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }

      if (errorCount > 0) {
        showToast(`有 ${errorCount} 筆記錄無法匯入`, 'error');
      }
    } catch (error) {
      console.error('匯入CSV數據失敗:', error);
      showToast('匯入失敗，請稍後再試', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // 匯出當前所有錯題為CSV
  const exportAllMistakes = async () => {
    setIsExporting(true);
    try {
      // 獲取所有錯題
      const mistakes = await getMistakes();
      
      if (mistakes.length === 0) {
        showToast('沒有錯題可供匯出', 'info');
        setIsExporting(false);
        return;
      }

      // 創建CSV標頭
      const headers = ['日期時間', '題目', '內容', '教育階段', '年級', '主題分類', '錯誤類型', 'AI分析', '錯誤步驟', '錯誤答案'];
      
      // 轉換錯題為CSV行，確保日期格式正確
      const rows = mistakes.map(mistake => {
        // 改進日期格式處理
        let dateStr = '';
        let timeStr = '';
        try {
          const createdAtDate = new Date(mistake.createdAt);
          
          // 確保日期是有效的
          if (!isNaN(createdAtDate.getTime())) {
            // 使用 ISO 格式確保匯入時可以被正確解析
            dateStr = createdAtDate.toISOString().split('T')[0]; // YYYY-MM-DD
            timeStr = createdAtDate.toISOString().split('T')[1].substring(0, 8); // HH:MM:SS
          } else {
            console.warn('無效的日期格式:', mistake.createdAt);
            dateStr = new Date().toISOString().split('T')[0];
            timeStr = new Date().toISOString().split('T')[1].substring(0, 8);
          }
        } catch (error) {
          console.error('處理日期時出錯:', error);
          dateStr = new Date().toISOString().split('T')[0];
          timeStr = new Date().toISOString().split('T')[1].substring(0, 8);
        }
        
        return [
          `${dateStr} ${timeStr}`,
          mistake.title,
          mistake.content.replace(/\n/g, ' '),
          mistake.educationLevel,
          '', // 年級不儲存在錯題模型中
          mistake.topicCategory,
          mistake.errorType,
          (mistake.explanation || '').replace(/\n/g, ' '),
          (mistake.errorSteps || '').replace(/\n/g, ' '),
          (mistake.userAnswer || '').replace(/\n/g, ' ')
        ];
      });
      
      // 創建CSV內容
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(item => `"${String(item).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // 創建下載連結
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `錯題記錄_完整_${dateStr}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast(`成功匯出 ${mistakes.length} 筆錯題記錄`, 'success');
    } catch (error) {
      console.error('匯出錯題失敗:', error);
      showToast('匯出失敗，請稍後再試', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // 取消預覽
  const cancelPreview = () => {
    setShowPreview(false);
    setPreviewData([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 輔助函數：映射教育階段字串到枚舉
  const mapEducationLevel = (level: string): EducationLevel => {
    if (level.includes('初中') || level.includes('JUNIOR')) {
      return EducationLevel.JUNIOR;
    } else if (level.includes('高中') || level.includes('SENIOR')) {
      return EducationLevel.SENIOR;
    }
    return EducationLevel.JUNIOR; // 默認
  };

  // 輔助函數：映射主題分類字串到枚舉
  const mapTopicCategory = (category: string): TopicCategory => {
    if (!category) return TopicCategory.NUMBER_ALGEBRA; // 默認
    
    if (category.includes('數') || category.includes('代數') || category.includes('NUMBER_ALGEBRA')) {
      return TopicCategory.NUMBER_ALGEBRA;
    } else if (category.includes('圖形') || category.includes('幾何') || category.includes('GEOMETRY_MEASURE')) {
      return TopicCategory.GEOMETRY_MEASURE;
    } else if (category.includes('數據') || category.includes('概率') || category.includes('STATS_PROBABILITY')) {
      return TopicCategory.STATS_PROBABILITY;
    } else if (category.includes('微積分') || category.includes('CALCULUS')) {
      return TopicCategory.CALCULUS;
    }
    
    return TopicCategory.NUMBER_ALGEBRA; // 默認
  };

  // 輔助函數：映射錯誤類型字串到枚舉
  const mapErrorType = (type: string): ErrorType => {
    if (!type) return ErrorType.UNKNOWN; // 默認
    
    if (type.includes('概念') || type.includes('CONCEPT_ERROR')) {
      return ErrorType.CONCEPT_ERROR;
    } else if (type.includes('邏輯') || type.includes('思路') || type.includes('LOGICAL_ERROR')) {
      return ErrorType.LOGICAL_ERROR;
    } else if (type.includes('審題') || type.includes('MISUNDERSTOOD')) {
      return ErrorType.MISUNDERSTOOD;
    } else if (type.includes('粗心') || type.includes('CARELESS_ERROR')) {
      return ErrorType.CARELESS_ERROR;
    } else if (type.includes('計算') || type.includes('CALCULATION_ERROR')) {
      return ErrorType.CALCULATION_ERROR;
    } else if (type.includes('計算機') || type.includes('CALCULATOR_ERROR')) {
      return ErrorType.CALCULATOR_ERROR;
    } else if (type.includes('時間') || type.includes('TIME_MANAGEMENT')) {
      return ErrorType.TIME_MANAGEMENT;
    }
    
    return ErrorType.UNKNOWN;
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="glass-card mb-8 bg-gradient-to-br from-indigo-900/80 to-blue-800/80 text-white rounded-lg shadow-xl p-8 backdrop-blur-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">錯題管理中心</h2>
          <p className="text-lg opacity-90">
            匯入或匯出你的錯題記錄，保持學習進度同步
          </p>
        </div>
      </div>

      {/* 匯入功能 */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden mb-8 transform transition-all hover:scale-[1.01]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
            </svg>
            匯入CSV錯題記錄
          </h3>
        </div>
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            你可以從CSV檔案匯入錯題記錄，方便在不同裝置間同步。
          </p>
          
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-grow">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                選擇CSV檔案
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="w-full px-3 py-2 placeholder-gray-400 text-gray-700 bg-white dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300 dark:border-gray-600"
                disabled={isUploading}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 min-w-[120px]"
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    處理中...
                  </div>
                ) : '選擇檔案'}
              </button>
            </div>
          </div>
          
          {/* 下方的提示說明 */}
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/30 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 text-sm text-blue-700 dark:text-blue-300">
                <h3 className="font-medium">CSV格式要求</h3>
                <p>CSV檔案應包含以下欄位：題目、內容、教育階段、主題分類、錯誤類型等。你可以先匯出一份完整CSV作為模板。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 預覽和匯入確認 */}
      {showPreview && previewData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden mb-8 animate-fade-in">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-gray-800 dark:to-gray-750">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <svg className="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              CSV預覽 ({previewData.length} 筆記錄)
            </h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {previewData.length > 0 && Object.keys(previewData[0]).slice(0, 5).map((header, index) => (
                      <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {previewData.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {Object.values(row).slice(0, 5).map((cell: any, cellIndex) => (
                        <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {String(cell).substring(0, 50)}{String(cell).length > 50 ? '...' : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {previewData.length > 5 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 text-center italic">
                        ... 還有 {previewData.length - 5} 筆記錄 ...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={cancelPreview}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                取消
              </button>
              <button
                onClick={importCSVData}
                className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    匯入中...
                  </div>
                ) : `確認匯入 ${previewData.length} 筆記錄`}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 匯出功能 */}
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden mb-8 transform transition-all hover:scale-[1.01]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-750">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <svg className="w-6 h-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            匯出錯題記錄
          </h3>
        </div>
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            將你所有的錯題記錄匯出為CSV檔案，方便備份或在其他裝置上使用。
          </p>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={exportAllMistakes}
              className="px-4 py-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
              disabled={isExporting}
            >
              {isExporting ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  匯出中...
                </div>
              ) : '匯出所有錯題'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 返回按鈕 */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => navigate('/mistakes')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回錯題列表
        </button>
      </div>
    </div>
  );
};

export default CSVManager; 