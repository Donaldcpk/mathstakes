import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EducationLevel, TopicCategory, ErrorType } from '../types';
import { generateMistakeInfoFromImage, generateAIExplanation } from '../utils/ai';
import { saveNewMistake } from '../utils/storage';
import { showToast } from '../utils/toast';
import MathDisplay from '../components/MathDisplay';

// 流程步驟枚舉
enum FormStep {
  BASIC_INFO = 0,
  IMAGE_UPLOAD = 1,
  ERROR_ANALYSIS = 2,
  AI_EXPLANATION = 3,
  SUMMARY = 4,
  COMPLETED = 5
}

// 題目來源枚舉
enum SourceType {
  TEXTBOOK = '書本',
  HOMEWORK = '功課',
  QUIZ = '小測',
  EXAM = '統測',
  FINAL_EXAM = '考試',
  PAST_PAPER = '歷屆試題',
  OTHER = '其他'
}

// 歷屆試題類型枚舉
enum PastPaperType {
  TSA = 'TSA',
  DSE = 'DSE'
}

// 在組件頂部添加一個新函數來處理LaTeX轉換
const convertToLatex = (text: string): string => {
  if (!text) return '';
  
  // 替換行內數學公式 (使用單個$符號包圍的文本)
  let result = text.replace(/\$([^\$]+?)\$/g, (match, formula) => {
    return `$${formula}$`;
  });
  
  // 替換塊級數學公式 (使用兩個$符號包圍的文本)
  result = result.replace(/\$\$([^\$]+?)\$\$/g, (match, formula) => {
    return `$$${formula}$$`;
  });
  
  return result;
};

const MistakeFormFiveSteps: React.FC = () => {
  const navigate = useNavigate();
  
  // 第一步：基本資訊
  const [educationLevel, setEducationLevel] = useState<EducationLevel>(EducationLevel.JUNIOR);
  const [grade, setGrade] = useState('');
  const [topicCategory, setTopicCategory] = useState<TopicCategory | ''>('');
  const [topic, setTopic] = useState('');
  const [sourceType, setSourceType] = useState<SourceType | ''>('');
  const [pastPaperType, setPastPaperType] = useState<PastPaperType | ''>('');
  const [pastPaperYear, setPastPaperYear] = useState('');
  const [otherSource, setOtherSource] = useState('');
  
  // 第二步：圖片上傳和題目識別
  const [language, setLanguage] = useState<'中文' | '英文'>('中文');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  
  // 第三步：錯誤分析
  const [errorTypes, setErrorTypes] = useState<ErrorType[]>([]);
  const [otherErrorType, setOtherErrorType] = useState('');
  const [errorSteps, setErrorSteps] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  
  // 第四步：AI解釋
  const [question1, setQuestion1] = useState('這種題目的正確答案是什麼？請一步步詳細解釋解題過程');
  const [question2, setQuestion2] = useState('針對此類型的題目，學生在解答過程中常會犯哪些具體錯誤？每種錯誤的根本原因是什麼？');
  const [question3, setQuestion3] = useState('如何避免在解答這類題目時犯錯？請給出針對性的學習建議和解題技巧');
  const [explanation, setExplanation] = useState('');
  
  // 第五步：總結和CSV生成
  const [csvData, setCsvData] = useState('');
  
  // 流程控制狀態
  const [currentStep, setCurrentStep] = useState<FormStep>(FormStep.BASIC_INFO);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState('');
  
  // 在MistakeFormFiveSteps組件中添加狀態
  const [isLatexFormatted, setIsLatexFormatted] = useState(false);
  
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
      
      showToast('題目識別成功！', 'success');
    } catch (error) {
      console.error('題目識別失敗:', error);
      
      // 格式化錯誤信息
      let errorMessage = '題目識別失敗';
      if (error instanceof Error) {
        if (error.message.includes('API Key') || error.message.includes('密鑰')) {
          errorMessage = '無法連接到AI服務：API密鑰無效';
        } else if (error.message.includes('網絡離線')) {
          errorMessage = '當前處於離線狀態，請在有網絡連接時嘗試識別圖片';
        } else if (error.message.includes('圖片格式')) {
          errorMessage = '圖片格式無效，請確保上傳的是JPG或PNG格式';
        } else if (error.message.includes('API 錯誤') || error.message.includes('API請求失敗')) {
          errorMessage = 'AI服務暫時不可用，請稍後再試';
        } else if (error.message.includes('數據格式異常') || error.message.includes('解析JSON')) {
          errorMessage = '圖片識別失敗，可能原因：圖片不夠清晰或內容難以辨認，請嘗試重新拍攝或使用手動輸入';
        } else if (error.message.includes('內容識別不完整')) {
          errorMessage = '無法從圖片中完整識別題目內容，請確保圖片清晰且包含完整的數學題目';
        } else if (error.message.includes('超時')) {
          errorMessage = '識別請求超時，請稍後重試';
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
  };

  // 處理錯誤類型多選
  const toggleErrorType = (errorType: ErrorType) => {
    setErrorTypes(prev => {
      if (prev.includes(errorType)) {
        return prev.filter(type => type !== errorType);
      } else {
        return [...prev, errorType];
      }
    });
  };

  // 獲取AI解釋
  const getAIExplanation = async () => {
    if (errorTypes.length === 0) {
      showToast('請選擇至少一種錯誤類型！', 'error');
      return;
    }
    
    setIsProcessing(true);
    setProcessingError('');
    
    try {
      // 合併所有選中的錯誤類型
      const combinedErrorType = errorTypes.join(', ') + 
        (otherErrorType ? (', ' + otherErrorType) : '');
      
      // 改進問題列表，使其更具針對性
      const questionsList = `
1. ${question1} 請詳細列出解題的完整步驟和正確答案，必須確保答案計算無誤。
2. ${question2} 請具體指出在「${subject}」這一課題中，學生常犯的明確錯誤，至少列出3個與本題直接相關的具體錯誤類型並說明原因。
3. ${question3} 請提供至少3個針對「${subject}」課題的具體學習策略，避免籠統或通用的建議，而是提供這類特定題目的解題技巧。
      `;
      
      const aiResponse = await generateAIExplanation({
        id: 'temp-id',
        title,
        content,
        subject,
        educationLevel,
        topicCategory: topicCategory as TopicCategory,
        errorType: ErrorType.UNKNOWN, // 實際上使用的是下面的組合錯誤類型
        errorSteps: errorSteps || undefined,
        userAnswer: userAnswer || undefined,
        createdAt: new Date().toISOString(),
        imageUrl: imagePreview || undefined,
        explanation: `錯誤類型：${combinedErrorType}\n年級：${grade}\n課題：${subject}\n題目描述：${content}\n學生錯誤答案：${userAnswer || '未提供'}\n\n${questionsList}`
      });
      
      setExplanation(aiResponse);
      setCurrentStep(FormStep.AI_EXPLANATION);
      showToast('AI解釋生成成功！', 'success');
    } catch (error) {
      console.error('生成 AI 解釋失敗：', error);
      
      // 格式化錯誤信息
      let errorMessage = '生成 AI 解釋失敗';
      if (error instanceof Error) {
        if (error.message.includes('API Key') || error.message.includes('密鑰')) {
          errorMessage = '無法連接到AI服務：API密鑰無效';
        } else if (error.message.includes('網絡離線')) {
          errorMessage = '當前處於離線狀態，請在有網絡連接時嘗試生成解釋';
        } else if (error.message.includes('超時')) {
          errorMessage = 'AI服務響應超時，請稍後再試';
        } else if (error.message.includes('API 請求失敗')) {
          errorMessage = 'AI服務暫時不可用，請稍後再試';
        } else {
          errorMessage = `生成解釋失敗：${error.message}`;
        }
      }
      
      setProcessingError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 生成CSV數據
  const generateCSV = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-TW');
    const timeStr = now.toLocaleTimeString('zh-TW');
    
    // 合併所有選中的錯誤類型
    const combinedErrorType = errorTypes.join(', ') + 
      (otherErrorType ? (', ' + otherErrorType) : '');
    
    // 題目來源信息
    let sourceInfo = sourceType;
    if (sourceType === SourceType.PAST_PAPER) {
      sourceInfo += ` (${pastPaperType} ${pastPaperYear})`;
    } else if (sourceType === SourceType.OTHER) {
      sourceInfo += ` (${otherSource})`;
    }
    
    // 構建CSV內容
    const headers = ['日期時間', '題目', '內容', '教育階段', '年級', '主題分類', '題目來源', '錯誤類型', 'AI分析'];
    const dataRow = [
      `${dateStr} ${timeStr}`,
      title,
      content.replace(/\n/g, ' '),
      educationLevel,
      grade,
      topicCategory,
      sourceInfo,
      combinedErrorType,
      explanation.replace(/\n/g, ' ')
    ];
    
    // 創建CSV文本
    const csvContent = [
      headers.join(','),
      dataRow.map(item => `"${String(item).replace(/"/g, '""')}"`).join(',')
    ].join('\n');
    
    setCsvData(csvContent);
    
    // 創建下載連結
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `錯題記錄_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setCurrentStep(FormStep.SUMMARY);
  };

  // 保存錯題
  const saveMistakeRecord = async () => {
    setIsProcessing(true);
    
    // 合併所有選中的錯誤類型
    const combinedErrorType = errorTypes.join(', ') + 
      (otherErrorType ? (', ' + otherErrorType) : '');
    
    // 最多重試3次
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptSave = async (): Promise<boolean> => {
      try {
        await saveNewMistake({
          title,
          content,
          subject,
          educationLevel,
          topicCategory: topicCategory as TopicCategory,
          errorType: ErrorType.UNKNOWN, // 使用UNKNOWN，實際類型存在explanation中
          errorSteps: errorSteps || undefined,
          userAnswer: userAnswer || undefined,
          explanation: `錯誤類型：${combinedErrorType}\n\n${explanation}`,
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
        showToast('錯題保存成功！', 'success');
        setCurrentStep(FormStep.COMPLETED);
      } else {
        throw new Error('達到最大重試次數，保存失敗');
      }
    } catch (error) {
      console.error('保存錯題失敗:', error);
      showToast('保存錯題失敗，請稍後再試。', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // 切換到下一步
  const goToNextStep = () => {
    if (currentStep < FormStep.COMPLETED) {
      setCurrentStep(prev => (prev + 1) as FormStep);
    }
  };

  // 返回上一步
  const goToPreviousStep = () => {
    if (currentStep > FormStep.BASIC_INFO) {
      setCurrentStep(prev => (prev - 1) as FormStep);
    }
  };

  // 渲染第一步：基本信息
  const renderBasicInfoStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">步驟 1：基本資訊</h3>
      
      {/* 教育階段 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          教育階段 <span className="text-red-500">*</span>
        </label>
        <div className="flex space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="educationLevel"
              checked={educationLevel === EducationLevel.JUNIOR}
              onChange={() => setEducationLevel(EducationLevel.JUNIOR)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2">初中</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="educationLevel"
              checked={educationLevel === EducationLevel.SENIOR}
              onChange={() => setEducationLevel(EducationLevel.SENIOR)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2">高中</span>
          </label>
        </div>
      </div>
      
      {/* 年級 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          年級 <span className="text-red-500">*</span>
        </label>
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">請選擇年級</option>
          {educationLevel === EducationLevel.JUNIOR ? (
            <>
              <option value="中一">中一</option>
              <option value="中二">中二</option>
              <option value="中三">中三</option>
            </>
          ) : (
            <>
              <option value="中四">中四</option>
              <option value="中五">中五</option>
              <option value="中六">中六</option>
            </>
          )}
        </select>
      </div>
      
      {/* 主題分類 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          主題分類 <span className="text-red-500">*</span>
        </label>
        <select
          value={topicCategory}
          onChange={(e) => setTopicCategory(e.target.value as TopicCategory)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">請選擇主題分類</option>
          <option value={TopicCategory.NUMBER_ALGEBRA}>數與代數</option>
          <option value={TopicCategory.GEOMETRY_MEASURE}>度量圖形與空間</option>
          <option value={TopicCategory.STATS_PROBABILITY}>數據處理</option>
          {educationLevel === EducationLevel.SENIOR && (
            <option value={TopicCategory.CALCULUS}>微積分基礎</option>
          )}
        </select>
      </div>
      
      {/* 具體課題 */}
      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
          具體課題（如有）
        </label>
        <input
          type="text"
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="例如：聯立方程、畢氏定理等"
        />
      </div>
      
      {/* 題目來源 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          題目來源 <span className="text-red-500">*</span>
        </label>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as SourceType)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">請選擇來源</option>
          <option value={SourceType.TEXTBOOK}>書本</option>
          <option value={SourceType.HOMEWORK}>功課</option>
          <option value={SourceType.QUIZ}>小測</option>
          <option value={SourceType.EXAM}>統測</option>
          <option value={SourceType.FINAL_EXAM}>考試</option>
          <option value={SourceType.PAST_PAPER}>歷屆試題</option>
          <option value={SourceType.OTHER}>其他</option>
        </select>
      </div>
      
      {/* 如果是歷屆試題，顯示額外選項 */}
      {sourceType === SourceType.PAST_PAPER && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              試題類別 <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="pastPaperType"
                  checked={pastPaperType === PastPaperType.TSA}
                  onChange={() => setPastPaperType(PastPaperType.TSA)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2">TSA</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="pastPaperType"
                  checked={pastPaperType === PastPaperType.DSE}
                  onChange={() => setPastPaperType(PastPaperType.DSE)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="ml-2">DSE</span>
              </label>
            </div>
          </div>
          
          <div>
            <label htmlFor="pastPaperYear" className="block text-sm font-medium text-gray-700 mb-2">
              年份 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="pastPaperYear"
              value={pastPaperYear}
              onChange={(e) => setPastPaperYear(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="例如：2022"
            />
          </div>
        </div>
      )}
      
      {/* 如果是其他，顯示輸入框 */}
      {sourceType === SourceType.OTHER && (
        <div>
          <label htmlFor="otherSource" className="block text-sm font-medium text-gray-700 mb-2">
            請描述來源 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="otherSource"
            value={otherSource}
            onChange={(e) => setOtherSource(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="例如：網絡資源、學習App等"
          />
        </div>
      )}
      
      <div className="pt-5">
        <div className="flex justify-between">
          <Link
            to="/"
            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            返回首頁
          </Link>
          <button
            type="button"
            onClick={goToNextStep}
            disabled={!grade || !topicCategory || !sourceType || 
              (sourceType === SourceType.PAST_PAPER && (!pastPaperType || !pastPaperYear)) ||
              (sourceType === SourceType.OTHER && !otherSource)
            }
            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            下一步
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染第二步：圖片上傳和AI分析
  const renderImageUploadStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">步驟 2：題目識別</h3>
      
      {/* 語言選擇 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          題目語言 <span className="text-red-500">*</span>
        </label>
        <div className="flex space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="language"
              checked={language === '中文'}
              onChange={() => setLanguage('中文')}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2">中文</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="language"
              checked={language === '英文'}
              onChange={() => setLanguage('英文')}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2">英文</span>
          </label>
        </div>
      </div>
      
      {/* 圖片上傳 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          上傳題目圖片
        </label>
        <div 
          className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <div className="space-y-1 text-center">
            {!imagePreview ? (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex justify-center text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                  >
                    <span>點擊此處或整個區域上傳圖片</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleImageChange} accept="image/*" />
                  </label>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
              </>
            ) : (
              <div className="relative">
                <img src={imagePreview} alt="題目預覽" className="max-h-64 max-w-full mx-auto" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation(); // 阻止事件冒泡
                    setImagePreview(null);
                  }}
                  className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 識別按鈕 */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleGenerateInfo}
          disabled={!imagePreview || isProcessing}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在識別...
            </>
          ) : (
            '使用AI分析題目'
          )}
        </button>
        <button
          type="button"
          onClick={switchToManualInput}
          className="ml-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          手動輸入
        </button>
      </div>
      
      {/* 識別結果與確認 */}
      {(title || content) && (
        <div className="mt-6 p-4 bg-gray-50 rounded-md border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-2">AI識別結果</h4>
          
          {/* 標題 */}
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              錯題標題 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="例如：二次方程式解法"
              required
            />
          </div>
          
          {/* 題目內容 */}
          <div className="mb-4">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              題目內容 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="例如：解方程式：x² + 5x + 6 = 0"
              required
            />
          </div>
          
          {/* 科目 */}
          <div className="mb-4">
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              科目/範圍 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="例如：代數、幾何、三角函數等"
              required
            />
          </div>
        </div>
      )}
      
      {processingError && (
        <div className="text-red-500 text-sm mt-2">
          {processingError}
        </div>
      )}
      
      <div className="pt-5">
        <div className="flex justify-between">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={goToPreviousStep}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              上一步
            </button>
            <Link
              to="/"
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              返回首頁
            </Link>
          </div>
          <button
            type="button"
            onClick={goToNextStep}
            disabled={!title || !content || !subject}
            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            下一步
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染第三步：錯誤分析
  const renderErrorAnalysisStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">步驟 3：錯誤分析</h3>
      
      {/* 錯誤類型選擇 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          錯誤類型（可多選） <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={errorTypes.includes(ErrorType.CONCEPT_ERROR)}
              onChange={() => toggleErrorType(ErrorType.CONCEPT_ERROR)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm">概念模糊</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={errorTypes.includes(ErrorType.LOGICAL_ERROR)}
              onChange={() => toggleErrorType(ErrorType.LOGICAL_ERROR)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm">思路混亂</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={errorTypes.includes(ErrorType.MISUNDERSTOOD)}
              onChange={() => toggleErrorType(ErrorType.MISUNDERSTOOD)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm">審題輕率</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={errorTypes.includes(ErrorType.CARELESS_ERROR)}
              onChange={() => toggleErrorType(ErrorType.CARELESS_ERROR)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm">粗心大意</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={errorTypes.includes(ErrorType.CALCULATION_ERROR)}
              onChange={() => toggleErrorType(ErrorType.CALCULATION_ERROR)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm">運算錯誤</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              checked={errorTypes.includes(ErrorType.UNKNOWN)}
              onChange={() => toggleErrorType(ErrorType.UNKNOWN)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-2 text-sm">其他</span>
          </label>
        </div>
        
        {/* 其他錯誤類型輸入框 */}
        {errorTypes.includes(ErrorType.UNKNOWN) && (
          <div className="mt-3">
            <label htmlFor="otherErrorType" className="block text-sm font-medium text-gray-700 mb-1">
              請描述其他錯誤類型 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="otherErrorType"
              value={otherErrorType}
              onChange={(e) => setOtherErrorType(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="例如：理解不透徹、時間管理不當等"
            />
          </div>
        )}
      </div>
      
      {/* 錯誤步驟 */}
      <div>
        <label htmlFor="errorSteps" className="block text-sm font-medium text-gray-700 mb-2">
          錯誤步驟或思路（選填）
        </label>
        <textarea
          id="errorSteps"
          value={errorSteps}
          onChange={(e) => setErrorSteps(e.target.value)}
          rows={3}
          className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="描述解題過程中的錯誤步驟或錯誤思路..."
        />
      </div>
      
      {/* 錯誤答案 */}
      <div>
        <label htmlFor="userAnswer" className="block text-sm font-medium text-gray-700 mb-2">
          錯誤答案（選填）
        </label>
        <textarea
          id="userAnswer"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          rows={2}
          className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="填寫得出的錯誤答案..."
        />
      </div>
      
      {/* 錯誤分析按鈕 */}
      <div className="mt-4">
        <button
          type="button"
          onClick={getAIExplanation}
          disabled={errorTypes.length === 0 || isProcessing || (errorTypes.includes(ErrorType.UNKNOWN) && !otherErrorType)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在生成分析...
            </>
          ) : (
            '生成AI錯誤分析'
          )}
        </button>
      </div>
      
      {processingError && (
        <div className="text-red-500 text-sm mt-2">
          {processingError}
        </div>
      )}
      
      <div className="pt-5">
        <div className="flex justify-between">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={goToPreviousStep}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              上一步
            </button>
            <Link
              to="/"
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              返回首頁
            </Link>
          </div>
          {/* 注意：這一步只有在獲取AI解釋後才能進行下一步 */}
        </div>
      </div>
    </div>
  );

  // 渲染第四步：AI解釋
  const renderAIExplanationStep = () => {
    // 初始化 isEditing 變數，解決未定義錯誤
    const isEditing = false;
    
    // 格式化 AI 解釋，確保內容能夠正確顯示
    const formatAIExplanation = (text: string) => {
      if (!text) return '暫無內容';
      
      console.log("原始AI解釋內容:", text); // 添加日誌以便調試
      // 簡化處理邏輯，確保能夠顯示任何內容
      return text;
    };
    
    return (
      <div className="step-container">
        <h2 className="step-title">第四步：AI 解釋與建議</h2>
        
        {/* 這個分區顯示錯題內容的摘要 */}
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <h3 className="font-semibold text-lg mb-2">錯題內容摘要：</h3>
          <p className="text-gray-700">{content}</p>
        </div>
        
        {/* AI 分析請求區域 */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-3">請告訴 AI 您想了解哪些方面：</h3>
          <p className="text-sm text-gray-500 mb-3">您可以修改下方問題內容，或保留預設問題</p>
          
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="block mb-1 text-gray-700">
                問題 1：這種題目的正確答案是什麼？如何一步步解題？
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="您可以輸入更具體的問題..."
                value={question1}
                onChange={(e) => setQuestion1(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block mb-1 text-gray-700">
                問題 2：學生常犯哪些錯誤？為什麼會犯這些錯誤？
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="您可以輸入更具體的問題..."
                value={question2}
                onChange={(e) => setQuestion2(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block mb-1 text-gray-700">
                問題 3：如何避免面對這種題目犯錯？有什麼學習建議？
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="您可以輸入更具體的問題..."
                value={question3}
                onChange={(e) => setQuestion3(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        {/* AI 解釋顯示區域 */}
        <div className="mb-6">
          <h3 className="font-semibold text-lg mb-2">AI 解釋：</h3>
          
          {!explanation ? (
            <div className="flex justify-center items-center bg-gray-50 p-8 rounded-md text-center">
              <div>
                <p className="text-gray-500 mb-4">目前尚未生成 AI 解釋</p>
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  onClick={getAIExplanation}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      正在生成...
                    </span>
                  ) : (
                    '生成 AI 解釋'
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-md p-4 prose max-w-none">
              {/* 使用MathDisplay組件顯示內容，根據isLatexFormatted決定是否轉換 */}
              <div className="whitespace-pre-wrap">
                {isLatexFormatted ? (
                  <MathDisplay content={explanation} className="whitespace-pre-wrap" />
                ) : (
                  <pre className="whitespace-pre-wrap">{explanation}</pre>
                )}
              </div>
              
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  className={`px-3 py-1 text-sm ${isLatexFormatted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} rounded-md hover:bg-opacity-80 focus:outline-none focus:ring-1 focus:ring-blue-300`}
                  onClick={() => setIsLatexFormatted(!isLatexFormatted)}
                >
                  {isLatexFormatted ? '顯示普通文本' : '顯示數學公式'}
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  onClick={getAIExplanation}
                  disabled={isProcessing}
                >
                  {isProcessing ? '重新生成中...' : '重新生成解釋'}
                </button>
              </div>
            </div>
          )}

          {processingError && (
            <div className="mt-3 text-red-500">
              生成解釋時出錯：{processingError}
            </div>
          )}
        </div>
        
        {/* 替換 StepNavigation 為直接的按鈕導航 */}
        <div className="pt-5">
          <div className="flex justify-between">
            <button
              type="button"
              onClick={goToPreviousStep}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              上一步
            </button>
            <button
              type="button"
              onClick={goToNextStep}
              disabled={!explanation}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              下一步
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 渲染第五步：總結和CSV
  const renderSummaryStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">步驟 5：保存錯題</h3>
      
      <div className="bg-green-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">CSV 下載完成</h3>
            <div className="mt-2 text-sm text-green-700">
              <p>您的錯題CSV文件已成功生成。如需再次下載，請點擊下方按鈕。</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            // 創建下載連結
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const dateStr = new Date().toLocaleDateString('zh-TW');
            link.setAttribute('href', url);
            link.setAttribute('download', `錯題記錄_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          重新下載CSV
        </button>
      </div>
      
      <div className="border-t border-gray-200 pt-5">
        <h4 className="text-md font-medium text-gray-900 mb-2">是否保存到錯題本？</h4>
        <p className="text-sm text-gray-500 mb-4">
          保存後，您可以隨時在錯題列表中查看和複習這道題目。
        </p>
        
        <div className="flex justify-between">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => navigate('/mistakes')}
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              不保存，回到錯題列表
            </button>
            <Link
              to="/"
              className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              返回首頁
            </Link>
          </div>
          <button
            type="button"
            onClick={saveMistakeRecord}
            disabled={isProcessing}
            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在保存...
              </>
            ) : (
              '保存到錯題本'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // 渲染完成步驟
  const renderCompletedStep = () => (
    <div className="text-center py-12">
      <svg className="mx-auto h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900">錯題保存成功！</h3>
      <p className="mt-2 text-sm text-gray-500">您的錯題已成功保存到錯題本中，可以隨時查看和複習。</p>
      <div className="mt-6">
        <button
          type="button"
          onClick={() => navigate('/mistakes')}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          回到錯題列表
        </button>
        <button
          type="button"
          onClick={() => {
            setCurrentStep(FormStep.BASIC_INFO);
            // 重置表單
            setTitle('');
            setContent('');
            setSubject('');
            setImagePreview(null);
            setErrorTypes([]);
            setOtherErrorType('');
            setErrorSteps('');
            setUserAnswer('');
            setExplanation('');
            setCsvData('');
          }}
          className="mx-2 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          添加另一個錯題
        </button>
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          返回首頁
        </Link>
      </div>
    </div>
  );

  // 渲染步驟指示器
  const renderProgressIndicator = () => {
    const steps = [
      { name: '基本資訊', status: currentStep >= FormStep.BASIC_INFO ? 'current' : 'upcoming' },
      { name: '題目識別', status: currentStep >= FormStep.IMAGE_UPLOAD ? 'current' : 'upcoming' },
      { name: '錯誤分析', status: currentStep >= FormStep.ERROR_ANALYSIS ? 'current' : 'upcoming' },
      { name: 'AI解釋', status: currentStep >= FormStep.AI_EXPLANATION ? 'current' : 'upcoming' },
      { name: '總結', status: currentStep >= FormStep.SUMMARY ? 'current' : 'upcoming' }
    ];

    return (
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center">
          {steps.map((step, stepIdx) => (
            <li key={step.name} className={`${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} relative`}>
              {currentStep > stepIdx ? (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-indigo-600" />
                  </div>
                  <div
                    className="relative flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-800"
                  >
                    <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="sr-only">{step.name}</span>
                  </div>
                </>
              ) : currentStep === stepIdx ? (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-gray-200" />
                  </div>
                  <div
                    className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-indigo-600 bg-white"
                    aria-current="step"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" aria-hidden="true" />
                    <span className="sr-only">{step.name}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="h-0.5 w-full bg-gray-200" />
                  </div>
                  <div
                    className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-transparent group-hover:bg-gray-300" aria-hidden="true" />
                    <span className="sr-only">{step.name}</span>
                  </div>
                </>
              )}
              <div className="hidden sm:block absolute top-10 text-center text-xs font-medium text-gray-500" style={{width: '100px', marginLeft: '-35px'}}>
                {step.name}
              </div>
            </li>
          ))}
        </ol>
      </nav>
    );
  };

  // 渲染當前步驟內容
  const renderStepContent = () => {
    switch (currentStep) {
      case FormStep.BASIC_INFO:
        return renderBasicInfoStep();
      case FormStep.IMAGE_UPLOAD:
        return renderImageUploadStep();
      case FormStep.ERROR_ANALYSIS:
        return renderErrorAnalysisStep();
      case FormStep.AI_EXPLANATION:
        return renderAIExplanationStep();
      case FormStep.SUMMARY:
        return renderSummaryStep();
      case FormStep.COMPLETED:
        return renderCompletedStep();
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900">添加錯題</h2>
        <p className="mt-4 text-lg text-gray-900">
          記錄、分析並從錯題中學習，讓每一個錯誤都成為進步的階梯。
        </p>
      </div>
      
      {currentStep < FormStep.COMPLETED && renderProgressIndicator()}
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {renderStepContent()}
        </div>
      </div>
    </div>
  );
};

export default MistakeFormFiveSteps; 