import React, { useState, useRef } from 'react';
import { parseCSVData, importMistakesFromCSV } from '../utils/csvHandler';
import { exportToCSV } from '../utils/csvExport';
import { Link } from 'react-router-dom';
import { getMistakes } from '../utils/storage';
import { IoArrowBack, IoDownload, IoCloudUpload } from 'react-icons/io5';
import { toast } from 'react-hot-toast';

interface CSVImportExportProps {
  onImportSuccess?: () => void;
  onImportStart?: () => void;
  onClose?: () => void;
}

const CSVImportExport: React.FC<CSVImportExportProps> = ({ 
  onImportSuccess, 
  onImportStart,
  onClose 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setValidationError(null);
      setImportErrors([]);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('無法讀取文件'));
        }
      };
      reader.onerror = () => reject(new Error('讀取文件時發生錯誤'));
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!file) {
      setValidationError('請先選擇CSV文件');
      return;
    }
    
    if (onImportStart) {
      onImportStart();
    }
    
    setIsImporting(true);
    setImportProgress(10);
    setImportErrors([]);
    setValidationError(null);
    
    try {
      console.log('開始讀取CSV文件:', file.name);
      const content = await readFileAsText(file);
      setImportProgress(30);
      
      // 記錄CSV內容的前100個字符（用於調試）
      const previewContent = content.substring(0, 100) + (content.length > 100 ? '...' : '');
      console.log('CSV內容預覽:', previewContent);
      
      // 使用新的 importMistakesFromCSV API
      console.log('開始解析和匯入CSV數據');
      setImportProgress(50);
      const result = await importMistakesFromCSV(content);
      
      setImportProgress(90);
      
      if (result.errors.length > 0) {
        console.warn('匯入完成但有警告:', result.errors);
        setImportErrors(result.errors);
      }
      
      if (result.success && result.importedCount > 0) {
        console.log(`成功匯入 ${result.importedCount} 條錯題記錄`);
        toast.success(`成功匯入 ${result.importedCount} 條錯題記錄`);
        
        if (onImportSuccess) {
          onImportSuccess();
        }
        
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else if (result.importedCount === 0) {
        // 沒有成功匯入任何記錄
        setValidationError('匯入失敗，未能匯入任何錯題記錄');
        console.error('匯入失敗：未能匯入任何記錄');
        toast.error('匯入失敗，未能匯入任何錯題');
      } else {
        setValidationError('匯入失敗，請檢查錯誤訊息');
        console.error('匯入失敗，但處理過程已完成');
        toast.error('匯入失敗，請查看詳細錯誤');
      }
      
      setImportProgress(100);
    } catch (error) {
      console.error('匯入CSV錯誤:', error);
      setValidationError(`匯入過程中發生錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`);
      toast.error('匯入過程中發生錯誤');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      const mistakes = await getMistakes();
      exportToCSV(mistakes);
    } catch (error) {
      console.error('匯出CSV錯誤:', error);
      alert('匯出CSV時發生錯誤');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">CSV錯題管理</h2>
        <Link 
          to="/"
          className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          <IoArrowBack className="mr-1" /> 返回首頁
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4 bg-blue-50">
          <h3 className="text-md font-medium mb-3 text-blue-900">匯入錯題</h3>
          <p className="text-sm text-gray-600 mb-4">
            從CSV文件匯入錯題。文件應包含正確的格式，包括標題、內容、科目等欄位。
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-white hover:bg-gray-50 border-blue-300">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <IoCloudUpload className="w-8 h-8 mb-3 text-blue-500" />
                  <p className="mb-2 text-sm text-gray-700">
                    <span className="font-semibold">點擊上傳CSV文件</span> 或拖放
                  </p>
                  <p className="text-xs text-gray-500">支援.CSV格式</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileChange} 
                />
              </label>
            </div>
            
            {file && (
              <div className="text-sm text-blue-700 bg-blue-100 p-2 rounded">
                已選擇: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </div>
            )}
            
            {validationError && (
              <div className="text-sm text-red-700 bg-red-100 p-2 rounded">
                錯誤: {validationError}
              </div>
            )}
            
            {importErrors.length > 0 && (
              <div className="text-sm text-orange-700 bg-orange-100 p-2 rounded max-h-32 overflow-y-auto">
                <p className="font-medium mb-1">匯入警告:</p>
                <ul className="list-disc list-inside">
                  {importErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center"
            >
              {isImporting ? (
                <>
                  <span className="inline-block animate-spin mr-2">⟳</span>
                  匯入中... {importProgress}%
                </>
              ) : (
                <>匯入錯題</>
              )}
            </button>
          </div>
        </div>
        
        <div className="border rounded-lg p-4 bg-purple-50">
          <h3 className="text-md font-medium mb-3 text-purple-900">匯出錯題</h3>
          <p className="text-sm text-gray-600 mb-4">
            將您的所有錯題匯出為CSV文件，以便備份或在其他設備上使用。
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg bg-white border-purple-300">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <IoDownload className="w-8 h-8 mb-3 text-purple-500" />
                  <p className="mb-2 text-sm text-gray-700">
                    <span className="font-semibold">匯出您的錯題數據</span>
                  </p>
                  <p className="text-xs text-gray-500">將生成.CSV文件下載到您的設備</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleExport}
              className="w-full px-4 py-2 text-white bg-purple-600 rounded-md hover:bg-purple-700 flex items-center justify-center"
            >
              匯出為CSV
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <h4 className="font-medium mb-1">CSV格式說明:</h4>
        <p className="mb-2">
          CSV文件應包含以下列: title, content, subject, educationLevel
        </p>
        <p className="italic">
          請確保CSV文件使用UTF-8編碼，並包含正確的標題行
        </p>
      </div>
    </div>
  );
};

export default CSVImportExport; 