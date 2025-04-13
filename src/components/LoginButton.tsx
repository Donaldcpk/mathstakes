import React from 'react';
import { useAuth } from '../context/AuthContext';

const LoginButton: React.FC = () => {
  const { currentUser, login, logout, loading } = useAuth();

  const handleAuth = async () => {
    if (currentUser) {
      await logout();
    } else {
      await login();
    }
  };

  return (
    <>
      {loading ? (
        <button
          className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 min-w-[120px]"
          disabled
        >
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          處理中...
        </button>
      ) : currentUser ? (
        <div className="flex items-center space-x-2">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
              {currentUser.displayName}
            </span>
            <span className="text-xs text-gray-500 truncate max-w-[120px]">
              {currentUser.email}
            </span>
          </div>
          <img
            src={currentUser.photoURL || '/default-avatar.png'}
            alt={currentUser.displayName || '用戶'}
            className="h-8 w-8 rounded-full border-2 border-indigo-200"
          />
          <button
            onClick={handleAuth}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 transition-all duration-200"
          >
            登出
          </button>
        </div>
      ) : (
        <button
          onClick={handleAuth}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
          </svg>
          使用Google登入
        </button>
      )}
    </>
  );
};

export default LoginButton; 