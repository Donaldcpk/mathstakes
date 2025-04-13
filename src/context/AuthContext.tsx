import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth, signInWithGoogle, signOut, isUserProfileComplete, getRedirectResult } from '../utils/firebase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isProfileComplete: boolean;
  checkProfileComplete: (userId: string) => Promise<boolean>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean>(false);
  const navigate = useNavigate();

  // 檢查用戶資料是否完整
  const checkProfileComplete = async (userId: string): Promise<boolean> => {
    try {
      const isComplete = await isUserProfileComplete(userId);
      setIsProfileComplete(isComplete);
      return isComplete;
    } catch (error) {
      console.error('檢查用戶資料時出錯', error);
      return false;
    }
  };

  // 處理重定向登入結果
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        if (!auth) return;
        
        console.log('檢查重定向登入結果...', new Date().toISOString());
        const result = await getRedirectResult(auth);
        
        console.log('重定向結果:', result ? '有結果' : '沒有結果', new Date().toISOString());
        
        if (result && result.user) {
          console.log('重定向登入成功', result.user.email, new Date().toISOString());
          
          // 保存用戶到狀態
          setCurrentUser(result.user);
          
          // 顯示成功消息
          toast.success('登入成功！歡迎回來，' + (result.user.displayName || '同學'), {
            duration: 5000,
            icon: '👋',
          });
          
          // 檢查用戶資料是否完整
          const isComplete = await checkProfileComplete(result.user.uid);
          console.log('用戶資料是否完整:', isComplete, new Date().toISOString());
          
          // 根據資料完整性導向不同頁面
          if (isComplete) {
            console.log('導航至錯題列表頁', new Date().toISOString());
            
            // 使用強制頁面刷新處理第三方Cookie或導航問題
            setTimeout(() => {
              window.location.href = '/mistakes';
            }, 500);
          } else {
            console.log('導航至資料設置頁', new Date().toISOString());
            
            // 使用強制頁面刷新處理第三方Cookie或導航問題
            setTimeout(() => {
              window.location.href = '/profile/setup';
            }, 500);
          }
        } else {
          console.log('沒有重定向結果或用戶信息為空', new Date().toISOString());
        }
      } catch (error) {
        console.error('處理重定向結果時出錯:', error, new Date().toISOString());
        toast.error('登入處理時出錯: ' + (error instanceof Error ? error.message : '未知錯誤'));
      } finally {
        setLoading(false);
      }
    };
    
    console.log('執行重定向處理邏輯', new Date().toISOString());
    handleRedirectResult();
  }, [navigate]);

  // 監聽用戶狀態變化
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    
    console.log('設置用戶狀態監聽器...');
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('用戶狀態變化', user ? user.email : '未登入');
      setCurrentUser(user);
      
      if (user) {
        await checkProfileComplete(user.uid);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (): Promise<void> => {
    try {
      setLoading(true);
      console.log('登入函數開始執行', new Date().toISOString());
      
      // 嘗試使用 signInWithGoogle 進行登入
      const user = await signInWithGoogle();
      
      // 如果直接獲取到用戶信息（彈出窗口方式成功）
      if (user) {
        console.log('直接登入成功', user.email, new Date().toISOString());
        setCurrentUser(user);
        
        toast.success('登入成功！歡迎回來，' + (user.displayName || '同學'), {
          duration: 3000,
          icon: '👋',
        });
        
        // 檢查用戶資料是否完整
        const isComplete = await checkProfileComplete(user.uid);
        console.log('資料完整性檢查結果:', isComplete, new Date().toISOString());
        
        // 根據資料完整性導向不同頁面
        if (isComplete) {
          console.log('導航至錯題列表頁', new Date().toISOString());
          
          // 使用強制頁面刷新處理第三方Cookie或導航問題
          setTimeout(() => {
            window.location.href = '/mistakes';
          }, 500);
        } else {
          console.log('導航至設置頁', new Date().toISOString());
          
          // 使用強制頁面刷新處理第三方Cookie或導航問題
          setTimeout(() => {
            window.location.href = '/profile/setup';
          }, 500);
        }
      } else {
        console.log('彈出窗口登入未返回用戶資料，可能使用了重定向', new Date().toISOString());
        // 重定向方式會在 handleRedirectResult 中處理
      }
    } catch (error) {
      console.error('登入失敗:', error, new Date().toISOString());
      if (error instanceof Error && error.message.includes('hd')) {
        toast.error('請使用學校的Google帳號登入', {
          duration: 4000,
          icon: '🏫',
        });
      } else if (error instanceof Error && error.message.includes('cookie')) {
        toast.error('瀏覽器可能阻止了第三方Cookie。請確保允許Cookie或嘗試其他瀏覽器', {
          duration: 6000,
        });
      } else {
        toast.error('登入失敗，請稍後再試: ' + (error instanceof Error ? error.message : '未知錯誤'), {
          duration: 5000,
        });
      }
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      await signOut();
      setCurrentUser(null);
      setIsProfileComplete(false);
      toast.success('已成功登出，期待您的下次使用', {
        duration: 3000,
        icon: '👋',
      });
      navigate('/');
    } catch (error) {
      console.error('登出失敗:', error);
      toast.error('登出失敗，請稍後再試', {
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    isProfileComplete,
    checkProfileComplete,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 