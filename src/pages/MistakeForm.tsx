import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EducationLevel, TopicCategory, ErrorType } from '../types';
import { generateMistakeInfoFromImage, generateAIExplanation } from '../utils/ai';
import { saveMistake } from '../utils/storage';
import { showToast } from '../utils/toast';

const subjects = [
  '代數',
  '幾何',
  '三角函數',
  '微積分',
  '概率與統計',
  '其他'
];

// 流程步驟枚舉
enum FormStep {
  UPLOAD_IMAGE = 0,
  CONFIRM_INFO = 1,
  ADD_ERROR_DETAILS = 2,
  REVIEW_EXPLANATION = 3,
  COMPLETED = 4
}

const MistakeForm: React.FC = () => {
  const navigate = useNavigate();
  
  // 基本表單狀態
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>(EducationLevel.JUNIOR);
  const [topicCategory, setTopicCategory] = useState<TopicCategory | ''>('');
  const [errorType, setErrorType] = useState<ErrorType | ''>('');
  const [errorSteps, setErrorSteps] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  
  // 圖片相關狀態
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // AI解釋相關狀態
  const [explanation, setExplanation] = useState('');
  
  // 流程控制狀態
  const [currentStep, setCurrentStep] = useState<FormStep>(FormStep.UPLOAD_IMAGE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  
  // 處理圖片上傳
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // 檢查檔案大小，提示用戶如果檔案太小
      if (file.size < 100 * 1024) { // 小於100KB
        showToast('警告：上傳的圖片檔案較小，可能會影響識別效果。建議使用更清晰的圖片。', 'warning');
      }
      
      // 檢查檔案類型
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        showToast('請上傳JPG或PNG格式的圖片。', 'error');
        return;
      }
      
      // 創建預覽URL，保持高質量
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        
        // 檢查圖片清晰度
        const img = new Image();
        img.onload = () => {
          // 檢查解析度是否足夠
          if (img.width < 800 || img.height < 800) {
            showToast('提示：上傳的圖片解析度較低，建議使用更高清晰度的圖片以提高識別準確度。', 'info');
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // 從圖片生成題目信息
  const handleGenerateInfo = async () => {
    if (!imagePreview) {
      showToast('請先上傳圖片', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessingError('');
    
    try {
      console.log('開始生成題目信息...');
      
      const recognizedInfo = await generateMistakeInfoFromImage(imagePreview);
      console.log('AI識別結果:', recognizedInfo);
      
      // 更新表單數據
      setTitle(recognizedInfo.title);
      setContent(recognizedInfo.content);
      setSubject(recognizedInfo.subject);
      setEducationLevel(recognizedInfo.educationLevel);
      if (recognizedInfo.topicCategory) {
        setTopicCategory(recognizedInfo.topicCategory);
      }
      
      showToast('題目識別成功！', 'success');
      
      // 直接前往確認信息步驟
      setCurrentStep(FormStep.CONFIRM_INFO);
    } catch (error) {
      console.error('題目識別失敗:', error);
      
      // 格式化錯誤信息
      let errorMessage = '題目識別失敗';
      if (error instanceof Error) {
        if (error.message.includes('API Key')) {
          errorMessage = '無法連接到AI服務：API密鑰無效';
        } else if (error.message.includes('圖片格式')) {
          errorMessage = '圖片格式無效，請確保上傳的是JPG或PNG格式';
        } else if (error.message.includes('API 錯誤')) {
          errorMessage = `AI服務錯誤：${error.message.split('API 錯誤：')[1] || '請稍後再試'}`;
        } else if (error.message.includes('數據格式異常')) {
          errorMessage = '圖片識別失敗，可能原因：圖片不夠清晰或內容難以辨認，請嘗試重新拍攝或使用手動輸入。';
        } else if (error.message.includes('圖片太大')) {
          errorMessage = '圖片檔案過大，請壓縮後重新上傳。';
        } else if (error.message.includes('內容為空')) {
          errorMessage = '無法從圖片識別出數學內容，請確保圖片清晰且包含數學題目。';
        } else {
          errorMessage = `題目識別失敗：${error.message}`;
        }
      }
      
      setProcessingError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 手動輸入模式（如果AI識別失敗）
  const switchToManualInput = () => {
    // 如果有錯誤訊息，清除它
    if (processingError) {
      setProcessingError('');
    }
    
    // 提示用戶已切換到手動模式
    showToast('已切換到手動輸入模式，請填寫題目資訊', 'info');
    
    setCurrentStep(FormStep.CONFIRM_INFO);
  };

  // 確認題目信息
  const confirmMistakeInfo = () => {
    if (!title || !content || !subject || !educationLevel) {
      showToast('請填寫所有必填欄位！', 'error');
      return;
    }
    
    if (educationLevel === EducationLevel.SENIOR && !topicCategory) {
      showToast('對於高中題目，請選擇主題分類！', 'error');
      return;
    }
    
    setCurrentStep(FormStep.ADD_ERROR_DETAILS);
  };

  // 獲取AI解釋
  const getAIExplanation = async () => {
    if (!errorType) {
      showToast('請選擇錯誤類型！', 'error');
      return;
    }
    
    setIsProcessing(true);
    setProcessingError('');
    
    try {
      const explanation = await generateAIExplanation({
        id: 'temp-id',
        title,
        content,
        subject,
        educationLevel,
        topicCategory: topicCategory as TopicCategory,
        errorType: errorType as ErrorType,
        errorSteps: errorSteps || undefined,
        userAnswer: userAnswer || undefined,
        createdAt: new Date().toISOString(),
        imageUrl: imagePreview || undefined
      });
      
      setExplanation(explanation);
      setCurrentStep(FormStep.REVIEW_EXPLANATION);
    } catch (error) {
      console.error('生成 AI 解釋失敗：', error);
      setProcessingError('生成 AI 解釋失敗，請稍後再試。');
    } finally {
      setIsProcessing(false);
    }
  };

  // 保存錯題
  const saveMistakeRecord = async () => {
    setIsProcessing(true);
    
    // 最多重試3次
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptSave = async (): Promise<boolean> => {
      try {
        await saveMistake({
          title,
          content,
          subject,
          educationLevel,
          topicCategory: topicCategory as TopicCategory,
          errorType: errorType as ErrorType,
          errorSteps: errorSteps || undefined,
          userAnswer: userAnswer || undefined,
          explanation,
          imageUrl: imagePreview || undefined,
          createdAt: new Date().toISOString()
        });
        
        return true;
      } catch (error) {
        console.error(`保存錯題嘗試 ${retryCount + 1}/${maxRetries} 失敗：`, error);
        if (retryCount < maxRetries - 1) {
          retryCount++;
          // 等待一段時間再重試，每次等待時間增加
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return false;
        } else {
          throw error;
        }
      }
    };
    
    try {
      let success = false;
      
      // 嘗試保存直到成功或達到最大重試次數
      while (!success && retryCount < maxRetries) {
        success = await attemptSave();
      }
      
      if (success) {
        setCurrentStep(FormStep.COMPLETED);
        showToast('錯題保存成功！', 'success');
        setTimeout(() => navigate('/mistakes'), 1500);
      } else {
        throw new Error('達到最大重試次數，儲存失敗');
      }
    } catch (error) {
      console.error('保存錯題最終失敗：', error);
      showToast('儲存錯題失敗，請再試一次。', 'error');
      
      // 顯示更多詳細錯誤資訊和指導
      let errorMessage = '儲存錯題失敗，請再試一次。';
      
      if (error instanceof Error) {
        if (error.message.includes('網絡') || error.message.includes('連接') || error.message.includes('network')) {
          errorMessage = '網絡連接問題，請檢查您的網絡連接並再試一次。';
        } else if (error.message.includes('超時') || error.message.includes('timeout')) {
          errorMessage = '請求超時，請稍後再試。';
        } else if (error.message.includes('權限') || error.message.includes('permission')) {
          errorMessage = '權限錯誤，請確保您已登入並擁有足夠權限。';
        }
      }
      
      setProcessingError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // 返回上一步
  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 渲染上傳圖片步驟
  const renderUploadImageStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-4">
        拍攝或上傳你的數學錯題圖片。清晰的圖片可以大幅提高AI識別的準確度。
      </p>
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
          id="image-upload"
        />
        
        <div className="space-y-2">
          <div className="text-xs text-gray-500 mb-3">
            <strong>提示：</strong> 為獲得最佳識別效果，請確保：
            <ul className="list-disc text-left ml-5 mt-1">
              <li>圖片清晰、對焦準確</li>
              <li>光線充足且均勻</li>
              <li>拍攝角度垂直於紙面</li>
              <li>題目和解答文字完整可見</li>
              <li>推薦解析度至少800x800像素</li>
            </ul>
          </div>
          
          <label
            htmlFor="image-upload"
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer inline-block"
          >
            選擇圖片
          </label>
        </div>
        
        {imagePreview && (
          <div className="mt-4">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-60 mx-auto object-contain mt-3 border border-gray-200 rounded-md shadow-sm"
            />
            <div className="mt-2 flex justify-center">
              <button
                type="button"
                className="text-sm text-red-600 hover:text-red-800"
                onClick={() => {
                  setImagePreview(null);
                }}
              >
                移除圖片
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={() => navigate('/mistakes')}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          取消
        </button>
        
        <div>
          <button
            type="button"
            onClick={switchToManualInput}
            className="mr-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            手動輸入
          </button>
          
          <button
            type="button"
            onClick={handleGenerateInfo}
            disabled={!imagePreview || isProcessing}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isProcessing ? '處理中...' : '識別題目'}
          </button>
        </div>
      </div>
      
      {processingError && (
        <div className="text-red-500 text-sm mt-2">
          {processingError}
        </div>
      )}
    </div>
  );

  // 渲染確認信息步驟
  const renderConfirmInfoStep = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 mb-4">
        請確認或編輯以下題目信息：
      </p>
      
      {/* 標題 */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          錯題標題 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="例如：二次方程式解法"
          required
        />
      </div>
      
      {/* 題目內容 */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          題目內容 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="例如：解方程式：x² + 5x + 6 = 0"
          required
        />
      </div>
      
      {/* 選擇科目、教育階段和主題分類 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
            科目 <span className="text-red-500">*</span>
          </label>
          <select
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          >
            <option value="" disabled>請選擇科目</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="educationLevel" className="block text-sm font-medium text-gray-700">
            教育階段 <span className="text-red-500">*</span>
          </label>
          <select
            id="educationLevel"
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
            className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          >
            {Object.values(EducationLevel).map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* 高中主題分類（僅當選擇高中時顯示） */}
      {educationLevel === EducationLevel.SENIOR && (
        <div>
          <label htmlFor="topicCategory" className="block text-sm font-medium text-gray-700">
            主題分類 <span className="text-red-500">*</span>
          </label>
          <select
            id="topicCategory"
            value={topicCategory}
            onChange={(e) => setTopicCategory(e.target.value as TopicCategory)}
            className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          >
            <option value="" disabled>請選擇主題分類</option>
            {Object.values(TopicCategory).map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      )}
      
      {/* 圖片預覽（如果有） */}
      {imagePreview && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            題目圖片
          </label>
          <div className="mt-1">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="max-h-40 object-contain border border-gray-200 rounded-md"
            />
          </div>
        </div>
      )}
      
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={goToPreviousStep}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          上一步
        </button>
        
        <button
          type="button"
          onClick={confirmMistakeInfo}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          確認並繼續
        </button>
      </div>
    </div>
  );

  // 渲染添加錯誤詳情步驟
  const renderAddErrorDetailsStep = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 mb-4">
        請添加你遇到的錯誤詳情：
      </p>
      
      {/* 錯誤類型 */}
      <div>
        <label htmlFor="errorType" className="block text-sm font-medium text-gray-700">
          錯誤類型 <span className="text-red-500">*</span>
        </label>
        <select
          id="errorType"
          value={errorType}
          onChange={(e) => setErrorType(e.target.value as ErrorType)}
          className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        >
          <option value="" disabled>請選擇錯誤類型</option>
          {Object.values(ErrorType).map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      
      {/* 錯誤的步驟或地方 */}
      <div>
        <label htmlFor="errorSteps" className="block text-sm font-medium text-gray-700">
          錯誤的步驟或地方
        </label>
        <textarea
          id="errorSteps"
          value={errorSteps}
          onChange={(e) => setErrorSteps(e.target.value)}
          rows={2}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="請描述你在哪個步驟或地方出現了錯誤"
        />
      </div>
      
      {/* 你的答案/解題思路 */}
      <div>
        <label htmlFor="userAnswer" className="block text-sm font-medium text-gray-700">
          你的答案/解題思路
        </label>
        <textarea
          id="userAnswer"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          rows={3}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="如果你有嘗試解題，請寫下你的思路或答案，幫助 AI 更好地理解你的錯誤"
        />
      </div>
      
      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={goToPreviousStep}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          上一步
        </button>
        
        <button
          type="button"
          onClick={getAIExplanation}
          disabled={isProcessing}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isProcessing ? '生成中...' : '獲取 AI 解釋'}
        </button>
      </div>
      
      {processingError && (
        <div className="text-red-500 text-sm mt-2">
          {processingError}
        </div>
      )}
    </div>
  );

  // 渲染查看解釋步驟
  const renderReviewExplanationStep = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 mb-4">
        以下是 AI 基於你的錯誤分析提供的解釋：
      </p>
      
      <div className="bg-gray-50 p-4 rounded-md">
        <h3 className="text-md font-medium text-gray-900 mb-2">AI 解釋</h3>
        <div className="text-sm text-gray-700 whitespace-pre-line">
          {explanation}
        </div>
      </div>
      
      <div className="flex justify-between pt-6">
        <button
          type="button"
          onClick={goToPreviousStep}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          返回
        </button>
        <button
          type="button"
          onClick={saveMistakeRecord}
          disabled={isProcessing}
          className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isProcessing ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              儲存中...
            </div>
          ) : '儲存錯題'}
        </button>
      </div>
      {processingError && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">錯誤</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{processingError}</p>
                <p className="mt-1">您可以：</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>檢查網絡連接</li>
                  <li>確認是否已登入</li>
                  <li>稍後再試</li>
                  <li>暫時保存為草稿（即將推出）</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 渲染完成步驟
  const renderCompletedStep = () => (
    <div className="text-center py-12">
      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-20 w-20 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900">錯題保存成功！</h3>
      <p className="mt-1 text-sm text-gray-500">
        正在返回錯題本...
      </p>
    </div>
  );

  // 渲染當前步驟的內容
  const renderStepContent = () => {
    switch (currentStep) {
      case FormStep.UPLOAD_IMAGE:
        return renderUploadImageStep();
      case FormStep.CONFIRM_INFO:
        return renderConfirmInfoStep();
      case FormStep.ADD_ERROR_DETAILS:
        return renderAddErrorDetailsStep();
      case FormStep.REVIEW_EXPLANATION:
        return renderReviewExplanationStep();
      case FormStep.COMPLETED:
        return renderCompletedStep();
      default:
        return null;
    }
  };

  // 進度指示器
  const renderProgressIndicator = () => {
    const steps = ['上傳圖片', '確認信息', '添加錯誤詳情', '查看解釋'];
    
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              {/* 連接線 */}
              {index > 0 && (
                <div 
                  className={`flex-1 h-1 mx-2 ${
                    index <= currentStep ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                />
              )}
              
              {/* 步驟圓點 */}
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 flex items-center justify-center rounded-full ${
                    index < currentStep 
                      ? 'bg-indigo-600 text-white' 
                      : index === currentStep 
                        ? 'border-2 border-indigo-600 text-indigo-600' 
                        : 'border-2 border-gray-300 text-gray-400'
                  }`}
                >
                  {index < currentStep ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span 
                  className={`mt-1 text-xs ${
                    index <= currentStep ? 'text-indigo-600' : 'text-gray-500'
                  }`}
                >
                  {step}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h2 className="text-2xl font-bold leading-7 text-gray-900">
          新增錯題
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          記錄你的數學錯題，獲取 AI 解釋
        </p>
      </div>
      
      <div className="border-t border-gray-200">
        <div className="p-6">
          {currentStep < FormStep.COMPLETED && renderProgressIndicator()}
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
};

export default MistakeForm; 