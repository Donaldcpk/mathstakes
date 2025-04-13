import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginButton from '../components/LoginButton';

const HomePage: React.FC = () => {
  const { currentUser, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-2">
            <span className="text-indigo-600">Mathstakes</span> - 數學學習的好夥伴
          </h1>
          <p className="mt-3 max-w-3xl mx-auto text-xl text-gray-500 mb-10">
            記錄錯誤，從錯誤中學習，掌握數學思維
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
            <p className="mt-4 text-lg text-gray-600">正在處理登入，請稍候...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto">
            <div className="md:flex">
              <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                {currentUser ? (
                  <div className="space-y-8">
                    <div className="text-center md:text-left">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">歡迎回來，{currentUser.displayName}！</h2>
                      <p className="text-gray-600">準備好繼續學習了嗎？</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Link
                        to="/mistakes"
                        className="inline-flex items-center justify-center px-5 py-4 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-md"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        我的錯題集
                      </Link>
                      <Link
                        to="/mistakes/new"
                        className="inline-flex items-center justify-center px-5 py-4 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        添加新錯題
                      </Link>
                    </div>
                    
                    <div className="flex justify-center md:justify-start">
                      <LoginButton />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="text-center md:text-left">
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">開始你的數學學習之旅</h2>
                      <p className="text-gray-600 mb-6">使用學校 Google 帳號登入，開始記錄和分析你的數學錯題。</p>
                    </div>
                    
                    <div className="flex flex-col items-center md:items-start space-y-4">
                      <LoginButton />
                      <p className="text-sm text-gray-500">我們只接受特定學校網域的登入</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="md:w-1/2 bg-indigo-700 p-8 md:p-12 text-white">
                <h3 className="text-xl font-semibold mb-4">Mathstakes 功能亮點</h3>
                <ul className="space-y-4">
                  <li className="flex items-start">
                    <svg className="h-6 w-6 text-indigo-300 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span><strong>智能收集</strong>：輕鬆拍照或手動輸入錯題，快速建立個人錯題庫</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-6 w-6 text-indigo-300 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span><strong>AI 診斷</strong>：人工智能分析錯題，找出概念性錯誤和解題盲點</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-6 w-6 text-indigo-300 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span><strong>智能複習</strong>：根據艾賓浩斯遺忘曲線安排複習，鞏固學習成果</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="h-6 w-6 text-indigo-300 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span><strong>師生協作</strong>：老師可查看學生錯題，提供個性化指導</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage; 