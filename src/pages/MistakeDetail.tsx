import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mistake, EducationLevel } from '../types';
import { getMistake, deleteMistake as deleteFromStorage, addExplanation } from '../utils/storage';
import { generateAIExplanation } from '../utils/ai';

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

const MistakeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mistake, setMistake] = useState<Mistake | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [retryCount, setRetryCount] = useState(0);

  // 從本地儲存獲取資料
  const fetchMistake = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    setLoadingError(null);
    
    // 模擬進度條
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        const newProgress = prev + Math.random() * 15;
        return newProgress > 90 ? 90 : newProgress;
      });
    }, 300);

    try {
      console.time(`fetch-mistake-${id}`);
      const mistakeData = await getMistake(id);
      console.timeEnd(`fetch-mistake-${id}`);
      
      if (mistakeData) {
        setMistake(mistakeData);
        setLoadingProgress(100);
      } else {
        setLoadingError('無法找到此錯題，它可能已被刪除或從未存在。');
      }
    } catch (error) {
      console.error(`獲取錯題 ID ${id} 失敗：`, error);
      setLoadingError(error instanceof Error ? error.message : '載入錯題失敗，請稍後再試。');
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  }, [id]);

  // 初始加載和重試機制
  useEffect(() => {
    fetchMistake();
  }, [fetchMistake, retryCount]);

  // 生成 AI 解釋
  const getAIExplanation = useCallback(async () => {
    if (!mistake || !id) return;
    
    setIsGeneratingExplanation(true);
    
    try {
      console.time('generate-ai-explanation');
      // 使用 OpenAI API 生成解釋
      const explanationText = await generateAIExplanation(mistake);
      console.timeEnd('generate-ai-explanation');
      
      // 將解釋儲存到本地儲存
      const updatedMistake = await addExplanation(id, explanationText);
      if (updatedMistake) {
        setMistake(updatedMistake);
      }
    } catch (error) {
      console.error('生成 AI 解釋失敗：', error);
      alert('生成解釋時出錯，請稍後再試。');
    } finally {
      setIsGeneratingExplanation(false);
    }
  }, [mistake, id]);

  // 刪除錯題
  const handleDeleteMistake = useCallback(async () => {
    if (!id || !window.confirm('確定要刪除這個錯題嗎？此操作無法復原。')) {
      return;
    }
    
    try {
      console.time('delete-mistake');
      const success = await deleteFromStorage(id);
      console.timeEnd('delete-mistake');
      
      if (success) {
        alert('錯題已成功刪除！');
        navigate('/mistakes');
      } else {
        alert('刪除錯題失敗，請稍後再試。');
      }
    } catch (error) {
      console.error(`刪除錯題 ID ${id} 失敗：`, error);
      alert('刪除錯題時出錯，請稍後再試。');
    }
  }, [id, navigate]);

  // 重新加載數據
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white shadow-lg rounded-lg overflow-hidden p-8">
        <div className="flex flex-col items-center justify-center h-64">
          <div className="w-full max-w-md bg-gray-200 rounded-full h-4 mb-4">
            <div 
              className="bg-indigo-600 h-4 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <p className="text-gray-700 text-lg font-medium">正在載入錯題資料...</p>
          <p className="text-gray-500 text-sm mt-2">請稍候，我們正在獲取您的錯題詳情</p>
        </div>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="bg-white shadow-lg rounded-lg overflow-hidden p-8 text-center">
        <div className="flex flex-col items-center justify-center h-64">
          <svg className="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">載入失敗</h2>
          <p className="text-lg text-gray-600 mb-6">{loadingError}</p>
          <div className="flex space-x-4">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              重新載入
            </button>
            <Link 
              to="/mistakes" 
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              返回錯題列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!mistake) {
    return (
      <div className="bg-white shadow-lg rounded-lg overflow-hidden p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">找不到錯題</h2>
        <p className="text-lg text-gray-500 mb-6">找不到 ID 為 {id} 的錯題。它可能已被刪除或從未存在。</p>
        <Link 
          to="/mistakes" 
          className="inline-flex items-center px-5 py-2.5 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          返回錯題列表
        </Link>
      </div>
    );
  }

  // 渲染錯題詳情
  return (
    <div className="container mx-auto px-4 py-8">
      {/* 返回和麵包屑導航 */}
      <div className="mb-6 flex items-center">
        <button
          onClick={() => navigate('/mistakes')}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-4"
        >
          <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回列表
        </button>
        <nav className="breadcrumb-item text-sm text-gray-500">
          <span>錯題簿</span>
          <span>{mistake?.title || '錯題詳情'}</span>
        </nav>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : loadingError ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{loadingError}</p>
            </div>
          </div>
        </div>
      ) : !mistake ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">找不到該錯題，可能已被刪除。</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 錯題詳情卡片 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover-lift neon-border">
            <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-gray-800 dark:to-gray-750">
              <div className="flex justify-between items-start">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white gradient-text">
                  {mistake.title}
                </h1>
                <div className="flex space-x-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    {mistake.subject}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {mistake.educationLevel}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-block mr-4">
                  📅 {formatDate(mistake.createdAt)}
                </span>
                {mistake.topicCategory && (
                  <span className="inline-block">
                    📚 {mistake.topicCategory}
                  </span>
                )}
              </div>
            </div>
            
            {/* 題目內容 */}
            <div className="px-6 py-6 bg-white dark:bg-gray-800">
              <div className="prose dark:prose-invert max-w-none">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">題目內容</h3>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg whitespace-pre-line">
                  {mistake.content}
                </div>
                
                {mistake.imageUrl && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">題目圖片</h3>
                    <div className="mt-2 flex justify-center">
                      <img 
                        src={mistake.imageUrl} 
                        alt="題目圖片" 
                        className="max-h-96 max-w-full rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300" 
                        onClick={() => window.open(mistake.imageUrl, '_blank')}
                      />
                    </div>
                  </div>
                )}
                
                {mistake.errorSteps && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">錯誤步驟</h3>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg whitespace-pre-line text-red-800 dark:text-red-200">
                      {mistake.errorSteps}
                    </div>
                  </div>
                )}
                
                {mistake.explanation ? (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">AI分析與解釋</h3>
                    <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg shadow-inner whitespace-pre-line">
                      {mistake.explanation}
                    </div>
                  </div>
                ) : (
                  <div className="mt-6">
                    <div className="text-center py-8 px-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <svg className="mx-auto h-12 w-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-yellow-800 dark:text-yellow-200">尚未生成AI解釋</h3>
                      <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">點擊下方按鈕生成關於這個錯題的AI分析</p>
                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={getAIExplanation}
                          disabled={isGeneratingExplanation}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
                        >
                          {isGeneratingExplanation ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              生成解釋中...
                            </>
                          ) : '生成AI解釋'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* 操作按鈕 */}
          <div className="flex justify-between items-center mt-8 space-x-4">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              刪除錯題
            </button>
            
            <div className="flex space-x-4">
              <button
                onClick={() => navigate('/mistakes/new')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                添加新錯題
              </button>
              
              <Link
                to="/mistakes/csv"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                管理CSV記錄
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MistakeDetail; 