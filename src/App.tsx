import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast';
import { useAuth, AuthProvider } from './context/AuthContext';

// 頁面組件
import HomePage from './pages/HomePage'
import MistakeForm from './pages/MistakeForm'
import MistakeDetail from './pages/MistakeDetail'
import MistakeList from './pages/MistakeList'
import LoginButton from './components/LoginButton';
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

// 應用程序根組件，包裝 AuthProvider
const AppWithAuth: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  );
};

// 主應用組件
function App() {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mathstakes</h1>
              <p className="text-gray-600">數學錯題學習平台</p>
            </div>
            <div className="flex items-center">
              <nav className="flex space-x-4 mr-4">
                <Link to="/" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                  首頁
                </Link>
                {currentUser && (
                  <>
                    <Link to="/mistakes" className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                      錯題本
                    </Link>
                    <Link to="/mistakes/new" className="px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                      新增錯題
                    </Link>
                  </>
                )}
              </nav>
              <LoginButton />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route 
              path="/mistakes" 
              element={
                <PrivateRoute>
                  <MistakeList />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/mistakes/new" 
              element={
                <PrivateRoute>
                  <MistakeForm />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/mistakes/:id" 
              element={
                <PrivateRoute>
                  <MistakeDetail />
                </PrivateRoute>
              } 
            />
            <Route path="/profile/setup" element={
              <PrivateRoute>
                <ProfileSetup />
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default AppWithAuth; 