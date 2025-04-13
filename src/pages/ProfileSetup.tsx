import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveUserProfile } from '../utils/firebase';
import { UserProfile } from '../types';
import toast from 'react-hot-toast';

const ProfileSetup: React.FC = () => {
  const { currentUser, checkProfileComplete } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 表單狀態
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [mathLevel, setMathLevel] = useState<number>(5);
  const [expectation, setExpectation] = useState('');
  
  // 表單驗證狀態
  const [errors, setErrors] = useState({
    className: '',
    studentId: '',
    expectation: ''
  });
  
  // 表單驗證
  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors = {
      className: '',
      studentId: '',
      expectation: ''
    };
    
    if (!className.trim()) {
      newErrors.className = '請輸入班別';
      isValid = false;
    }
    
    if (!studentId.trim()) {
      newErrors.studentId = '請輸入學號';
      isValid = false;
    }
    
    if (!expectation.trim()) {
      newErrors.expectation = '請簡單描述你的學習期望';
      isValid = false;
    } else if (expectation.length < 5) {
      newErrors.expectation = '學習期望太短，請多寫一些';
      isValid = false;
    }
    
    setErrors(newErrors);
    return isValid;
  };
  
  // 提交表單
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      toast.error('請先登入');
      return;
    }
    
    if (!validateForm()) {
      toast.error('請填寫所有必填項目');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // 構建用戶資料
      const userProfile: UserProfile = {
        uid: currentUser.uid,
        displayName: currentUser.displayName || '未命名用戶',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || undefined,
        className,
        studentId,
        mathLevel,
        expectation,
        createdAt: new Date().toISOString(),
        isProfileComplete: true
      };
      
      // 保存到 Firebase
      const success = await saveUserProfile(userProfile);
      
      if (success) {
        toast.success('資料設置成功！');
        await checkProfileComplete(currentUser.uid);
        navigate('/mistakes');
      } else {
        toast.error('資料設置失敗，請重試');
      }
    } catch (error) {
      console.error('設置用戶資料時出錯:', error);
      toast.error('設置資料時發生錯誤，請重試');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden max-w-2xl mx-auto my-8">
      <div className="px-6 py-5 border-b border-gray-200 bg-indigo-50">
        <h2 className="text-2xl font-bold text-gray-900">完善您的資料</h2>
        <p className="text-gray-600 mt-1">
          在開始使用 Mathstakes 前，請提供一些基本資訊以便我們為您提供更好的服務。
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-1">
              班別 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="className"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="例如：1A"
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.className ? 'border-red-300' : ''}`}
            />
            {errors.className && (
              <p className="mt-1 text-sm text-red-600">{errors.className}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
              學號 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="studentId"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="例如：22001"
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.studentId ? 'border-red-300' : ''}`}
            />
            {errors.studentId && (
              <p className="mt-1 text-sm text-red-600">{errors.studentId}</p>
            )}
          </div>
        </div>
        
        <div>
          <label htmlFor="mathLevel" className="block text-sm font-medium text-gray-700 mb-1">
            數學能力自評（0-10）
          </label>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">0</span>
            <input
              type="range"
              id="mathLevel"
              min="0"
              max="10"
              step="1"
              value={mathLevel}
              onChange={(e) => setMathLevel(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-gray-500">10</span>
            <span className="ml-4 text-indigo-600 font-medium">{mathLevel}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>需要大量協助</span>
            <span>一般水平</span>
            <span>精通</span>
          </div>
        </div>
        
        <div>
          <label htmlFor="expectation" className="block text-sm font-medium text-gray-700 mb-1">
            學習期望 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="expectation"
            value={expectation}
            onChange={(e) => setExpectation(e.target.value)}
            rows={3}
            placeholder="您希望通過 Mathstakes 達成什麼學習目標？例如：我希望能提高代數能力，減少粗心錯誤..."
            className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${errors.expectation ? 'border-red-300' : ''}`}
          />
          {errors.expectation && (
            <p className="mt-1 text-sm text-red-600">{errors.expectation}</p>
          )}
        </div>
        
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                處理中...
              </>
            ) : (
              '完成設置並開始使用'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileSetup; 