import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mistake } from '../types';
import { getMistake, deleteMistake as deleteFromStorage, addExplanation } from '../utils/storage';
import { generateAIExplanation } from '../utils/ai';
import MathDisplay from '../components/MathDisplay';
import { IoArrowBack, IoTrash, IoRefresh } from 'react-icons/io5';

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 從本地儲存獲取資料
  useEffect(() => {
    const fetchMistake = async () => {
      if (!id) {
        setLoadingError('無效的錯題ID');
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setLoadingError(null);
      
      try {
        // 模擬加載進度
        const progressInterval = setInterval(() => {
          setLoadingProgress(prev => Math.min(prev + 5, 90));
        }, 100);
        
        const data = await getMistake(id);
        
        clearInterval(progressInterval);
        setLoadingProgress(100);
        
        if (data) {
          setMistake(data);
        } else {
          setLoadingError('找不到此錯題，可能已被刪除');
        }
      } catch (error) {
        console.error('獲取錯題詳情失敗：', error);
        setLoadingError('載入錯題詳情時出錯，請稍後再試');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMistake();
  }, [id, retryCount]);

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
    if (!id) return;
    
    try {
      console.time('delete-mistake');
      const success = await deleteFromStorage(id);
      console.timeEnd('delete-mistake');
      
      if (success) {
        setShowDeleteModal(false);
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <Link 
          to="/mistakes" 
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <IoArrowBack className="mr-1.5 -ml-1 h-5 w-5" />
          返回錯題列表
        </Link>
        
        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <IoTrash className="mr-1.5 -ml-1 h-5 w-5" />
          刪除錯題
        </button>
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
          <div className="mt-4">
            <button
              onClick={handleRetry}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <IoRefresh className="mr-1.5 -ml-1 h-5 w-5" />
              重試載入
            </button>
          </div>
        </div>
      ) : mistake ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {mistake.title}
            </h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {mistake.subject}
              </span>
            </div>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <div className="prose prose-blue max-w-none dark:prose-invert">
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">錯題內容</h2>
                <div className="mt-2 text-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                  {mistake.content}
                </div>
              </div>
              
              {mistake.imageUrls && mistake.imageUrls.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">錯題圖片</h2>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mistake.imageUrls.map((url, index) => (
                      <div key={index} className="overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        <img 
                          src={url} 
                          alt={`錯題圖片 ${index + 1}`}
                          className="w-full object-contain h-64"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">錯誤類型</h2>
                <div className="mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    {mistake.errorType}
                  </span>
                </div>
              </div>
              
              {mistake.description && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">錯誤描述</h2>
                  <div className="mt-2 text-gray-600 dark:text-gray-400">
                    {mistake.description}
                  </div>
                </div>
              )}
              
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">其他信息</h2>
                <div className="mt-2 text-gray-600 dark:text-gray-400">
                  <p>創建時間：{formatDate(mistake.createdAt)}</p>
                </div>
              </div>
              
              {mistake.aiExplanation ? (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">AI分析與解釋</h3>
                  <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg shadow-inner whitespace-pre-line">
                    <MathDisplay content={mistake.aiExplanation} />
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
      ) : null}
      
      {/* 刪除確認對話框 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <IoTrash className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">確認刪除</h3>
              <p className="text-sm text-gray-500 mt-2">
                您確定要刪除這個錯題嗎？此操作無法撤銷，所有相關數據將被永久刪除。
              </p>
            </div>
            <div className="flex justify-center space-x-4 mt-4">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="inline-flex justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteMistake}
                className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MistakeDetail; 