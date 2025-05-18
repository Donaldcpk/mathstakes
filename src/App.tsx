import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from 'react-error-boundary';
import HomePage from './pages/HomePage';
import MistakeList from './pages/MistakeList';
import MistakeDetail from './pages/MistakeDetail';
import MistakeFormFiveSteps from './pages/MistakeFormFiveSteps';
import TestAI from './pages/TestAI';
import OfflineIndicator from './components/OfflineIndicator';
import CSVManager from './pages/CSVManager';
import { setupNetworkListener } from './utils/syncManager';

// 全局錯誤處理組件
interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">應用發生錯誤</h2>
        <p className="text-gray-700 mb-6">非常抱歉，應用遇到了問題。請嘗試刷新頁面。</p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="bg-gray-100 p-4 rounded mb-4 text-left overflow-auto max-w-lg mx-auto text-xs">
            {error.message}
          </pre>
        )}
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          刷新頁面
        </button>
      </div>
    </div>
  );
};

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

function App() {
  // 初始化網絡監聽器
  useEffect(() => {
    // 設置網絡監聽器，處理離線變更
    setupNetworkListener();
    console.log('已設置網絡監聽器，將自動同步離線變更');
  }, []);

  return (
    <Router>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <AuthProvider>
          <Toaster position="top-center" />
          <OfflineIndicator />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/mistakes" element={<PrivateRoute><MistakeList /></PrivateRoute>} />
            <Route path="/mistakes/:id" element={<PrivateRoute><MistakeDetail /></PrivateRoute>} />
            <Route path="/mistakes/new" element={<PrivateRoute><MistakeFormFiveSteps /></PrivateRoute>} />
            <Route path="/mistakes/csv" element={<CSVManager />} />
            <Route path="/test-ai" element={<TestAI />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App; 