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
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="px-6 py-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {mistake.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-gray-600">
            <span className="inline-flex items-center text-base">
              📅 {formatDate(mistake.createdAt)}
            </span>
            <span className="text-gray-400 mx-1">|</span>
            <span className="text-base">{mistake.subject}</span>
            <span className="text-gray-400 mx-1">|</span>
            <span className="text-base">{mistake.errorType}</span>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button
            onClick={handleDeleteMistake}
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-red-600 hover:bg-red-700 shadow-sm"
          >
            刪除
          </button>
        </div>
      </div>
      
      <div className="border-t border-gray-200">
        <dl>
          {/* 題目內容 */}
          <div className="bg-gray-50 px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-base font-medium text-gray-700">
              題目內容
            </dt>
            <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line leading-relaxed">
              {mistake.content}
            </dd>
          </div>
          
          {/* 錯誤類型 */}
          <div className="bg-white px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-base font-medium text-gray-700">
              錯誤類型
            </dt>
            <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                {mistake.errorType}
              </span>
            </dd>
          </div>
          
          {/* 錯誤步驟或地方 */}
          {mistake.errorSteps && (
            <div className="bg-gray-50 px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-base font-medium text-gray-700">
                錯誤的步驟或地方
              </dt>
              <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">
                {mistake.errorSteps}
              </dd>
            </div>
          )}
          
          {/* 科目 */}
          <div className="bg-white px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-base font-medium text-gray-700">
              科目
            </dt>
            <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                {mistake.subject}
              </span>
            </dd>
          </div>
          
          {/* 教育階段 */}
          <div className="bg-gray-50 px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-base font-medium text-gray-700">
              教育階段
            </dt>
            <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {mistake.educationLevel || EducationLevel.JUNIOR}
              </span>
            </dd>
          </div>
          
          {/* 主題分類（僅高中顯示） */}
          {mistake.educationLevel === EducationLevel.SENIOR && mistake.topicCategory && (
            <div className="bg-white px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-base font-medium text-gray-700">
                主題分類
              </dt>
              <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  {mistake.topicCategory}
                </span>
              </dd>
            </div>
          )}
          
          {/* 你的答案（如果有） */}
          {mistake.userAnswer && (
            <div className="bg-gray-50 px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-base font-medium text-gray-700">
                你的答案
              </dt>
              <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-line">
                {mistake.userAnswer}
              </dd>
            </div>
          )}
          
          {/* AI 解釋 */}
          <div className="bg-white px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-base font-medium text-gray-700">
              解釋與指導
            </dt>
            <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2">
              {mistake.explanation ? (
                <div className="whitespace-pre-line bg-indigo-50 p-4 rounded-lg border border-indigo-100 leading-relaxed">
                  {mistake.explanation}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">此錯題尚未有解釋與指導。</p>
                  <button
                    type="button"
                    onClick={getAIExplanation}
                    disabled={isGeneratingExplanation}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {isGeneratingExplanation ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        生成AI解釋中...
                      </>
                    ) : '獲取AI解釋與指導'}
                  </button>
                </div>
              )}
            </dd>
          </div>
          
          {/* 圖片（如果有） */}
          {mistake.imageUrl && (
            <div className="bg-gray-50 px-6 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-base font-medium text-gray-700">
                相關圖片
              </dt>
              <dd className="mt-2 text-base text-gray-900 sm:mt-0 sm:col-span-2">
                <div className="mt-2">
                  <a href={mistake.imageUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={mistake.imageUrl}
                      alt="錯題圖片"
                      className="max-h-80 object-contain border border-gray-200 rounded-md shadow-sm"
                    />
                  </a>
                </div>
              </dd>
            </div>
          )}
        </dl>
      </div>
      
      <div className="px-6 py-6 bg-gray-50 border-t border-gray-200 flex justify-between">
        <Link
          to="/mistakes"
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          返回錯題列表
        </Link>
        
        <Link
          to="/mistakes/new"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          新增錯題
        </Link>
      </div>
    </div>
  );
};

export default MistakeDetail; 