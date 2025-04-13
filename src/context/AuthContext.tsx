import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth, signInWithGoogle, signOut, isUserProfileComplete } from '../utils/firebase';
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
      console.error('檢查用戶資料時出錯:', error);
      return false;
    }
  };

  // 監控用戶身份狀態
  useEffect(() => {
    setLoading(true);
    
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        setCurrentUser(user);
        setLoading(false);
      });
      
      // 在組件卸載時取消訂閱
      return () => unsubscribe();
    } else {
      // 如果 auth 為 null，直接設置為未登入狀態
      setCurrentUser(null);
      setLoading(false);
      return () => {};
    }
  }, []);

  const login = async (): Promise<void> => {
    try {
      setLoading(true);
      const user = await signInWithGoogle();
      setCurrentUser(user);
      
      if (user) {
        toast.success('登入成功！歡迎回來，' + (user.displayName || '同學'), {
          duration: 3000,
          icon: '👋',
        });
        
        // 檢查用戶資料是否完整
        const isComplete = await checkProfileComplete(user.uid);
        
        // 根據資料完整性導向不同頁面
        if (isComplete) {
          navigate('/mistakes');
        } else {
          navigate('/profile/setup');
        }
      }
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
    } finally {
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