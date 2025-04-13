import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Mistake, EducationLevel } from '../types';
import { getMistakes, initializeSampleData, clearMistakesCache } from '../utils/storage';
import { exportToExcel } from '../utils/excel';

// 格式化日期函數
const formatDate = (dateString: string | Date): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[date.getDay()];
  
  return `${year}年${month}月${day}日 (星期${weekDay})`;
};

const MistakeList: React.FC = () => {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [isFetching, setIsFetching] = useState(false);

  // 從本地儲存獲取資料
  const fetchMistakes = useCallback(async (showLoadingUI = true) => {
    if (isFetching) return; // 防止重複請求
    
    try {
      if (showLoadingUI) {
        setLoadingError(null);
        setIsLoading(true);
        setLoadingProgress(0);
      }
      
      setIsFetching(true);
      
      // 實現分批加載
      let initialDataLoaded = false;
      
      // 模擬進度條
      const progressInterval = showLoadingUI ? setInterval(() => {
        setLoadingProgress(prev => {
          if (initialDataLoaded) return Math.min(prev + 5, 90);
          return Math.min(prev + Math.random() * 8, 70);
        });
      }, 300) : null;
      
      // 先加載基本示例數據，讓用戶可以快速看到畫面
      await initializeSampleData();
      initialDataLoaded = true;
      
      if (showLoadingUI) {
        setLoadingProgress(75);
      }
      
      // 獲取所有錯題（可能較慢的操作）
      const data = await getMistakes();
      setMistakes(data);
      
      if (showLoadingUI) {
        setLoadingProgress(100);
        if (progressInterval) clearInterval(progressInterval);
      }
    } catch (error) {
      console.error('獲取錯題失敗：', error);
      if (showLoadingUI) {
        setLoadingError(error instanceof Error ? error.message : '載入錯題資料失敗，請稍後再試');
      }
    } finally {
      if (showLoadingUI) {
        setIsLoading(false);
      }
      setIsFetching(false);
    }
  }, [isFetching]);

  // 初始加載
  useEffect(() => {
    fetchMistakes(true);
  }, [fetchMistakes]);
  
  // 監聽背景數據更新事件
  useEffect(() => {
    const handleMistakesUpdated = (event: Event) => {
      // 檢查自定義事件類型
      if (event instanceof CustomEvent && event.detail?.mistakes) {
        console.log('接收到錯題數據更新事件');
        setMistakes(event.detail.mistakes);
      }
    };
    
    // 添加事件監聽
    window.addEventListener('mistakesUpdated', handleMistakesUpdated);
    
    // 組件卸載時移除事件監聽
    return () => {
      window.removeEventListener('mistakesUpdated', handleMistakesUpdated);
    };
  }, []);

  // 使用useMemo優化篩選操作，避免不必要的重新計算
  const filteredMistakes = useMemo(() => {
    return mistakes.filter(mistake => {
      const matchesSearch = mistake.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          mistake.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = filterSubject ? mistake.subject === filterSubject : true;
      const matchesLevel = filterLevel ? mistake.educationLevel === filterLevel : true;
      return matchesSearch && matchesSubject && matchesLevel;
    });
  }, [mistakes, searchTerm, filterSubject, filterLevel]);

  // 獲取所有科目（用於過濾）
  const subjects = useMemo(() => {
    return Array.from(new Set(mistakes.map(m => m.subject)));
  }, [mistakes]);

  // 重新加載資料
  const handleReload = useCallback(async () => {
    // 清除緩存，確保獲取最新數據
    clearMistakesCache();
    await fetchMistakes(true);
  }, [fetchMistakes]);

  // 匯出為 Excel
  const handleExportToExcel = useCallback(() => {
    if (filteredMistakes.length === 0) {
      alert('沒有可匯出的錯題！');
      return;
    }
    
    try {
      exportToExcel(filteredMistakes);
    } catch (error) {
      console.error('匯出到 Excel 失敗：', error);
      alert('匯出到 Excel 失敗，請稍後再試。');
    }
  }, [filteredMistakes]);
  
  // 搜尋和過濾處理函數
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);
  
  const handleSubjectFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterSubject(e.target.value);
  }, []);
  
  const handleLevelFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterLevel(e.target.value);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white shadow-lg rounded-lg overflow-hidden p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-full max-w-md bg-gray-200 rounded-full h-4 mb-4">
            <div 
              className="bg-indigo-600 h-4 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <p className="text-gray-700 text-lg font-medium">正在載入錯題資料...</p>
          <p className="text-gray-500 text-sm mt-2">請稍候，我們正在獲取您的錯題列表</p>
        </div>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="bg-white shadow-lg rounded-lg overflow-hidden p-8 text-center">
        <div className="flex flex-col items-center justify-center py-12">
          <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">載入失敗</h2>
          <p className="text-lg text-gray-600 mb-6">{loadingError}</p>
          <div className="flex space-x-4">
            <button
              onClick={handleReload}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              重新載入
            </button>
            <Link 
              to="/" 
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              返回首頁
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              我的錯題本
            </h2>
            <p className="text-base text-gray-600">
              共 {mistakes.length} 道錯題，不斷學習進步
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              匯出到 Excel
            </button>
            <button
              onClick={handleReload}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              disabled={isFetching}
            >
              {isFetching ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              重新整理
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="flex-grow">
            <input
              type="text"
              placeholder="搜尋錯題..."
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full text-base border-gray-300 rounded-md"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          <div className="flex space-x-3">
            <select
              className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              value={filterSubject}
              onChange={handleSubjectFilterChange}
            >
              <option value="">所有科目</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            
            <select
              className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
              value={filterLevel}
              onChange={handleLevelFilterChange}
            >
              <option value="">所有階段</option>
              {Object.values(EducationLevel).map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <ul className="divide-y divide-gray-200">
        {filteredMistakes.length > 0 ? (
          filteredMistakes.map((mistake) => (
            <li key={mistake.id} className="hover:bg-gray-50">
              <Link
                to={`/mistakes/${mistake.id}`}
                className="block"
              >
                <div className="px-6 py-5">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                    <div className="flex-1 min-w-0 mb-2 md:mb-0 md:mr-4">
                      <p className="text-xl font-semibold text-indigo-600 mb-1">
                        {mistake.title}
                      </p>
                      <p className="text-base text-gray-700 line-clamp-2">
                        {mistake.content}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                        {mistake.subject}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                        {mistake.errorType}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {mistake.educationLevel}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div className="text-sm text-gray-500 mb-1 sm:mb-0">
                      <span className="inline-block mr-2">
                        📅 {formatDate(mistake.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${mistake.explanation ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {mistake.explanation ? '已解釋' : '未解釋'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))
        ) : (
          <li className="px-6 py-12 text-center">
            <div className="max-w-lg mx-auto">
              <svg className="h-24 w-24 text-indigo-200 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              
              {mistakes.length === 0 ? (
                <>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">歡迎使用 Mathstakes！</h3>
                  <p className="text-gray-600 mb-6">
                    您的錯題本目前是空的。開始記錄您的第一個數學錯題，讓 AI 幫助您理解和改進！
                  </p>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500 mb-2">您可以通過以下方式添加錯題：</p>
                    <ul className="text-sm text-gray-600 text-left list-disc pl-5 mb-6 space-y-2">
                      <li>拍照上傳數學題目，AI 自動識別內容</li>
                      <li>手動輸入題目和錯誤詳情</li>
                      <li>截圖或掃描錯題並上傳</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">沒有符合條件的錯題</h3>
                  <p className="text-gray-600 mb-6">
                    嘗試調整搜尋或篩選條件，或添加新的錯題。
                  </p>
                </>
              )}
              
              <Link 
                to="/mistakes/new" 
                className="inline-flex items-center px-5 py-2.5 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                添加第一個錯題
              </Link>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
};

export default MistakeList; 