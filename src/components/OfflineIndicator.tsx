import React, { useState, useEffect } from 'react';
import { isOnline } from '../utils/networkRetry';

/**
 * 離線狀態指示器組件
 * 在網絡連接狀態發生變化時顯示提示
 */
const OfflineIndicator: React.FC = () => {
  const [online, setOnline] = useState<boolean>(isOnline());
  const [showOffline, setShowOffline] = useState<boolean>(false);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    // 監聽網絡狀態變化
    const handleOnline = () => {
      setOnline(true);
      setShowOffline(false);
      setShowReconnected(true);
      
      // 5秒後隱藏重新連接提示
      setTimeout(() => setShowReconnected(false), 5000);
    };

    const handleOffline = () => {
      setOnline(false);
      setShowOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 初始狀態
    setShowOffline(!isOnline());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 如果在線且沒有提示，不渲染任何內容
  if (online && !showReconnected) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {showOffline && (
        <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-bold">您當前處於離線狀態</p>
            <p className="text-sm">部分功能可能無法使用，連接恢復後將自動同步</p>
          </div>
        </div>
      )}

      {showReconnected && (
        <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center animate-fade-in-down">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-bold">網絡已重新連接</p>
            <p className="text-sm">您可以繼續正常使用所有功能</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineIndicator; 