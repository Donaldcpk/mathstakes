import React, { useState, useEffect } from 'react';
import { generateMistakeInfoFromImage, generateAIExplanation } from '../utils/ai';
import { Mistake, EducationLevel, TopicCategory, ErrorType } from '../types';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import ApiKeyInput from '../components/ApiKeyInput';

const TestAI: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [showDirectKeyInput, setShowDirectKeyInput] = useState<boolean>(true);

  // 載入時檢查是否有保存的API金鑰
  useEffect(() => {
    const savedApiKey = localStorage.getItem('mathstakes_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      console.log('從本地存儲加載API金鑰');
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 檢查檔案類型
    if (!file.type.includes('image/')) {
      toast.error('請選擇圖片檔案');
      return;
    }
    
    // 創建圖片預覽
      const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImagePreview(event.target.result as string);
        setImageUrl(event.target.result as string);
      }
      };
      reader.readAsDataURL(file);
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageUrl(e.target.value);
    
    // 如果是有效的 URL，更新預覽
    if (isValidURL(e.target.value)) {
      setImagePreview(e.target.value);
    } else {
      setImagePreview(null);
    }
  };

  // 處理直接輸入的API金鑰
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };

  // 保存API金鑰到本地存儲
  const saveApiKey = () => {
    if (!apiKey.trim()) {
      toast.error('請輸入有效的API金鑰');
      return;
    }
    
    if (!apiKey.startsWith('sk-or-')) {
      toast.error('請輸入有效的OpenRouter API金鑰 (格式: sk-or-...)');
      return;
    }

    localStorage.setItem('mathstakes_api_key', apiKey);
    toast.success('API金鑰已保存');
    console.log('API金鑰已保存到本地存儲');
  };

  const isValidURL = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 檢查 URL 是否有效
    if (!imageUrl) {
      setError('請輸入圖片 URL 或上傳圖片');
      return;
    }

    // 檢查是否有API金鑰
    if (apiKey && apiKey.startsWith('sk-or-')) {
      localStorage.setItem('mathstakes_api_key', apiKey);
      console.log('臨時保存API金鑰');
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // 呼叫 AI 處理函數
      console.log('開始生成題目信息...');
      const result = await generateMistakeInfoFromImage(imageUrl);
      
      console.log('AI識別結果:', result);
      setAiResult(result);
      
    } catch (err: any) {
      console.error('圖片處理出錯:', err);
      setError(err.message || '圖片處理失敗，請重試');
      toast.error(err.message || '圖片處理失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center mb-6">
        <Link 
          to="/" 
          className="text-indigo-600 hover:text-indigo-800 mr-4 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回
        </Link>
        <h1 className="text-2xl font-bold">測試 AI 圖片識別</h1>
      </div>

      {/* 直接API金鑰輸入區域 */}
      {showDirectKeyInput && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">設置 OpenRouter API 金鑰</h3>
          <p className="text-sm text-gray-600 mb-4">
            要使用圖片識別功能，您需要設置 OpenRouter API 金鑰。
            <a 
              href="https://openrouter.ai/keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline ml-1"
            >
              獲取 API 金鑰
            </a>
          </p>

          <div className="flex items-end gap-4">
            <div className="flex-grow">
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                API 金鑰 (以 sk-or- 開頭)
              </label>
              <input
                type="text"
                id="apiKey"
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="輸入您的 OpenRouter API 金鑰"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              type="button"
              onClick={saveApiKey}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              保存金鑰
            </button>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            <p>您的 API 金鑰會安全地存儲在本地設備上，不會發送到我們的伺服器。</p>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">測試圖片識別</h2>
        
        <form onSubmit={handleSubmit}>
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              上傳圖片
            </label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageChange}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              或輸入圖片 URL
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={handleImageUrlChange}
              placeholder="https://example.com/image.jpg"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          {imagePreview && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">預覽圖片</p>
              <div className="border border-gray-200 rounded-md p-2 overflow-hidden max-h-72 flex justify-center">
                <img 
                  src={imagePreview} 
                  alt="預覽" 
                  className="max-w-full max-h-64 object-contain"
                />
              </div>
            </div>
          )}
          
          {error && (
            <div className="mb-4 text-red-500 text-sm p-2 bg-red-50 rounded-md">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !imageUrl}
            className={`w-full py-2 px-4 rounded-md ${
              loading || !imageUrl
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white font-medium`}
          >
            {loading ? '處理中...' : '識別題目'}
          </button>
        </form>
        
        {aiResult && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">識別結果</h3>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700">標題</p>
                <p className="bg-white p-2 rounded border border-gray-200">
                  {aiResult.title || '未識別標題'}
                </p>
              </div>
              
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700">內容</p>
                <pre className="bg-white p-2 rounded border border-gray-200 whitespace-pre-wrap text-sm">
                  {aiResult.content || '未識別內容'}
            </pre>
          </div>
              
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700">學科</p>
                <p className="bg-white p-2 rounded border border-gray-200">
                  {aiResult.subject || '未識別學科'}
                </p>
      </div>

              <div className="flex justify-end mt-4">
                <Link
                  to="/mistakes/new"
                  state={{ mistakeInfo: aiResult }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  使用此結果創建錯題
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 text-sm text-gray-500">
        <p>提示：為了獲得最佳識別效果，請上傳清晰的數學題目圖片。AI將嘗試識別題目的標題、內容和學科。</p>
        </div>
    </div>
  );
};

export default TestAI; 