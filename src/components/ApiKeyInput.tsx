import React, { useState } from 'react';
import { addApiKey } from '../utils/apiKeyManager';
import { toast } from 'react-hot-toast';

/**
 * API金鑰輸入組件
 * 允許用戶輸入和保存 OpenRouter API 金鑰
 */
const ApiKeyInput: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('meta-llama/llama-4-maverick:free');
  const [isVisible, setIsVisible] = useState(false);

  // 可選模型列表
  const modelOptions = [
    { value: 'meta-llama/llama-4-maverick:free', label: 'Meta Llama 4 (免費)' },
    { value: 'anthropic/claude-3-opus:beta', label: 'Claude 3 Opus' },
    { value: 'anthropic/claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'google/gemini-1.5-pro', label: 'Google Gemini 1.5 Pro' },
    { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o' }
  ];

  // 處理表單提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      toast.error('請輸入有效的 API 金鑰');
      return;
    }
    
    if (!apiKey.startsWith('sk-or-')) {
      toast.error('請輸入有效的 OpenRouter API 金鑰，必須以 sk-or- 開頭');
      return;
    }
    
    try {
      // 添加新的 API 金鑰
      addApiKey(apiKey, model);
      
      // 重置表單
      setApiKey('');
      toast.success('API 金鑰已成功設置');
    } catch (error) {
      console.error('設置 API 金鑰時出錯:', error);
      toast.error('設置 API 金鑰時出錯');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-2">設置 OpenRouter API 金鑰</h3>
      <p className="text-sm text-gray-600 mb-4">
        要使用圖片識別和 AI 解釋功能，您需要設置自己的 OpenRouter API 金鑰。
        <a 
          href="https://openrouter.ai/keys" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline ml-1"
        >
          獲取 API 金鑰
        </a>
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
            API 金鑰
          </label>
          <div className="relative">
            <input
              type={isVisible ? "text" : "password"}
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="輸入 OpenRouter API 金鑰 (sk-or-...)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setIsVisible(!isVisible)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
            >
              {isVisible ? 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg> : 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
            AI 模型
          </label>
          <select
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {modelOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          保存 API 金鑰
        </button>
      </form>
      
      <div className="mt-3 text-xs text-gray-500">
        <p>您的 API 金鑰會安全地存儲在本地設備上，不會發送到我們的伺服器。</p>
      </div>
    </div>
  );
};

export default ApiKeyInput; 