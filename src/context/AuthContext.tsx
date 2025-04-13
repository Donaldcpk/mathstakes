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
        
        console.log('檢查重定向登入結果...');
        const result = await getRedirectResult(auth);
        
        if (result && result.user) {
          console.log('重定向登入成功', result.user);
          setCurrentUser(result.user);
          toast.success('登入成功！歡迎回來，' + (result.user.displayName || '同學'), {
            duration: 3000,
            icon: '👋',
          });
          
          // 檢查用戶資料是否完整
          const isComplete = await checkProfileComplete(result.user.uid);
          
          // 根據資料完整性導向不同頁面
          if (isComplete) {
            navigate('/mistakes');
          } else {
            navigate('/profile/setup');
          }
        }
      } catch (error) {
        console.error('處理重定向結果時出錯:', error);
        toast.error('登入處理時出錯，請再試一次');
      } finally {
        setLoading(false);
      }
    };
    
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
      // signInWithGoogle 現在會進行重定向，不再返回用戶對象
      await signInWithGoogle();
      // 登入成功邏輯已在 handleRedirectResult 函數中處理
    } catch (error) {
      console.error('登入失敗:', error);
      if (error instanceof Error && error.message.includes('hd')) {
        toast.error('請使用學校的Google帳號登入', {
          duration: 4000,
          icon: '🏫',
        });
      } else {
        toast.error('登入失敗，請稍後再試', {
          duration: 3000,
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