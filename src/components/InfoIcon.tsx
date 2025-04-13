import React from 'react';

/**
 * 信息圖標組件
 * 用於顯示提示信息的小圖標，鼠標懸停時會顯示提示文本
 */
const InfoIcon: React.FC = () => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      className="h-5 w-5 text-gray-400 inline-block ml-1 cursor-help"
      viewBox="0 0 20 20" 
      fill="currentColor"
    >
      <path 
        fillRule="evenodd" 
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" 
        clipRule="evenodd" 
      />
    </svg>
  );
};

export default InfoIcon; 