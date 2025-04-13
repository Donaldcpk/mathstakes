import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth, AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from 'react-error-boundary';
import HomePage from './pages/HomePage';
import MistakeList from './pages/MistakeList';
import MistakeDetail from './pages/MistakeDetail';
import MistakeForm from './pages/MistakeForm';
import ProfileSetup from './pages/ProfileSetup';

// 需要登入才能訪問的路由保護組件
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();

  // 如果正在載入中，可以顯示一個加載指示器
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        <p className="mt-4 text-gray-600 font-medium">正在載入您的資料...</p>
      </div>
    );
  }

  // 如果未登入，重定向到首頁
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // 如果已登入，顯示子組件
  return <>{children}</>;
};

// 錯誤處理元件
function ErrorFallback({ error }: { error: any }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-lg p-8 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-red-600 mb-4">應用發生錯誤</h2>
        <p className="text-gray-700 mb-4">非常抱歉，應用遇到了問題。請嘗試刷新頁面。</p>
        <div className="bg-gray-100 p-4 rounded overflow-auto">
          <code className="text-sm text-red-500">{error.message}</code>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          刷新頁面
        </button>
      </div>
    </div>
  );
}

// 應用程序根組件，包裝 AuthProvider
const AppWithAuth: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  // 測試 API 連接
  useEffect(() => {
    fetch('/api')
      .then(res => res.json())
      .then(data => {
        console.log('API 健康檢查:', data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('API 檢查失敗:', err);
        // API 失敗但不阻止應用啟動
        setTimeout(() => setIsLoading(false), 1000); // 確保即使 API 無法訪問也會繼續
      });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <div className="ml-4 text-lg text-gray-700">載入中...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/mistakes" element={<PrivateRoute><MistakeList /></PrivateRoute>} />
            <Route path="/mistakes/:id" element={<PrivateRoute><MistakeDetail /></PrivateRoute>} />
            <Route path="/mistakes/new" element={<PrivateRoute><MistakeForm /></PrivateRoute>} />
            <Route path="/profile/setup" element={<PrivateRoute><ProfileSetup /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default AppWithAuth; 