import React, { useState } from 'react';
import { generateMistakeInfoFromImage, generateAIExplanation } from '../utils/ai';
import { Mistake, EducationLevel, TopicCategory, ErrorType } from '../types';
import { toast } from 'react-hot-toast';

const TestAI: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [recognitionResult, setRecognitionResult] = useState<any>(null);
  const [explanationResult, setExplanationResult] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageRecognition = async () => {
    if (!imageUrl) {
      toast.error('請先上傳圖片');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const result = await generateMistakeInfoFromImage(imageUrl);
      setRecognitionResult(result);
      toast.success('圖片識別成功');
    } catch (error) {
      console.error('圖片識別錯誤:', error);
      setError(error instanceof Error ? error.message : '未知錯誤');
      toast.error('圖片識別失敗');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateExplanation = async () => {
    if (!recognitionResult) {
      toast.error('請先進行圖片識別');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      // 創建Mistake對象
      const mistake: Mistake = {
        id: 'test-id',
        title: recognitionResult.title,
        content: recognitionResult.content,
        subject: recognitionResult.subject,
        educationLevel: EducationLevel.JUNIOR,
        topicCategory: TopicCategory.NUMBER_ALGEBRA,
        errorType: ErrorType.CONCEPT_ERROR,
        createdAt: new Date().toISOString(),
        imageUrl: imageUrl
      };

      const explanation = await generateAIExplanation(mistake);
      setExplanationResult(explanation);
      toast.success('解釋生成成功');
    } catch (error) {
      console.error('解釋生成錯誤:', error);
      setError(error instanceof Error ? error.message : '未知錯誤');
      toast.error('解釋生成失敗');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI整合測試頁面</h1>

      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">圖片識別測試</h2>
        
        <div className="mb-4">
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageChange}
            className="mb-4"
          />
          
          {imageUrl && (
            <div className="mt-2 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">預覽圖片:</p>
              <img src={imageUrl} alt="預覽" className="max-h-64 border rounded" />
            </div>
          )}
          
          <button
            onClick={handleImageRecognition}
            disabled={!imageUrl || isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isProcessing ? '處理中...' : '測試圖片識別'}
          </button>
        </div>
        
        {recognitionResult && (
          <div className="mt-4 p-4 bg-white rounded border">
            <h3 className="font-medium mb-2">識別結果:</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
              {JSON.stringify(recognitionResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">錯題解釋測試</h2>
        
        <button
          onClick={handleGenerateExplanation}
          disabled={!recognitionResult || isProcessing}
          className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {isProcessing ? '處理中...' : '測試錯題解釋'}
        </button>
        
        {explanationResult && (
          <div className="mt-4 p-4 bg-white rounded border">
            <h3 className="font-medium mb-2">解釋結果:</h3>
            <div className="bg-gray-100 p-4 rounded text-sm whitespace-pre-line">
              {explanationResult}
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          <h3 className="font-medium mb-2">錯誤:</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default TestAI; 