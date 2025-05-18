import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mistake, EducationLevel } from '../types';
import { getMistake, deleteMistake as deleteFromStorage, addExplanation } from '../utils/storage';
import { generateAIExplanation } from '../utils/ai';
import MathDisplay from '../components/MathDisplay';
import { IoArrowBack, IoTrash, IoRefresh, IoClose } from 'react-icons/io5';
import { formatDate } from '../utils/helpers';
import { getMathJaxConfig, containsLatexFormula } from '../utils/formulaFormatter';

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
  const [mathJaxLoaded, setMathJaxLoaded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  // 載入MathJax
  useEffect(() => {
    // 檢查是否已經載入過MathJax
    if (!window.MathJax && !mathJaxLoaded) {
      // 插入MathJax配置和腳本
      const head = document.head || document.getElementsByTagName('head')[0];
      const mathJaxHtml = getMathJaxConfig();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = mathJaxHtml;
      
      // 將所有子節點添加到head中
      Array.from(tempDiv.children).forEach(node => {
        head.appendChild(node);
      });
      
      setMathJaxLoaded(true);
    }
  }, [mathJaxLoaded]);

  // 處理數學公式渲染
  useEffect(() => {
    if (mistake && window.MathJax && contentRef.current) {
      // 檢查內容中是否包含數學公式
      const hasFormulas = containsLatexFormula(mistake.content) || 
                        (mistake.explanation && containsLatexFormula(mistake.explanation));
      
      if (hasFormulas) {
        // 重新渲染數學公式
        window.MathJax.typeset && window.MathJax.typeset([contentRef.current]);
      }
    }
  }, [mistake]);

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
        
        // 渲染數學公式
        setTimeout(() => {
          if (window.MathJax && window.MathJax.typeset && contentRef.current) {
            window.MathJax.typeset([contentRef.current]);
          }
        }, 100);
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="ml-4 text-lg text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  if (loadingError || !mistake) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4">
          <p className="font-bold">錯誤</p>
          <p>{loadingError || '找不到此錯題記錄'}</p>
        </div>
        <Link 
          to="/" 
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <IoArrowBack className="mr-2" /> 返回列表
        </Link>
      </div>
    );
  }

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
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {mistake.title}
          </h3>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {mistake.subject}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
              {mistake.educationLevel}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              {mistake.errorType}
            </span>
          </div>
        </div>
        
        <div ref={contentRef} className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <div className="prose prose-blue max-w-none dark:prose-invert">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">錯題內容</h2>
              <div className="mt-2 text-gray-800 dark:text-gray-300 whitespace-pre-wrap">
                {containsLatexFormula(mistake.content) 
                  ? <MathDisplay math={mistake.content} />
                  : mistake.content
                }
              </div>
            </div>
            
            {mistake.imageUrl && (
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">錯題圖片</h2>
                <div className="mt-2 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                  <img 
                    src={mistake.imageUrl}
                    alt="錯題圖片"
                    className="w-full object-contain max-h-96"
                  />
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
            
            {mistake.errorSteps && (
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">錯誤步驟</h2>
                <div className="mt-2 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {mistake.errorSteps}
                </div>
              </div>
            )}
            
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">其他信息</h2>
              <div className="mt-2 text-gray-600 dark:text-gray-400">
                <p>創建時間：{formatDate(mistake.createdAt)}</p>
                {mistake.lastReviewedAt && (
                  <p>上次複習：{formatDate(mistake.lastReviewedAt)}</p>
                )}
                {mistake.reviewCount !== undefined && (
                  <p>複習次數：{mistake.reviewCount}</p>
                )}
              </div>
            </div>
            
            {mistake.explanation ? (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">AI分析與解釋</h3>
                <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg shadow-inner whitespace-pre-line">
                  {containsLatexFormula(mistake.explanation) 
                    ? <MathDisplay math={mistake.explanation} />
                    : mistake.explanation
                  }
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
                          生成中...
                        </>
                      ) : (
                        <>
                          <IoRefresh className="mr-2 -ml-1 h-5 w-5" />
                          生成AI解釋
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">確認刪除</h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <IoClose className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-5">
              <p className="text-gray-700">
                確定要刪除這個錯題嗎？此操作無法恢復。
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteMistake}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MistakeDetail; 