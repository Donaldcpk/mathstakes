import React, { useEffect, useState } from 'react';

/**
 * 頁腳組件
 * 顯示在每個頁面底部，包含版本號和最後更新時間
 */
const Footer: React.FC = () => {
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  
  useEffect(() => {
    // 格式化當前日期和時間
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setCurrentDateTime(`${formattedDate} ${formattedTime}`);
    
    // 每分鐘更新一次時間
    const timer = setInterval(() => {
      const now = new Date();
      const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setCurrentDateTime(`${formattedDate} ${formattedTime}`);
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="py-3 mt-auto text-center text-gray-500 text-xs">
      <div className="container mx-auto">
        <p>Mathstakes v1.0</p>
        <p>最後更新: {currentDateTime}</p>
      </div>
    </footer>
  );
};

export default Footer; 