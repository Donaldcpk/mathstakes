import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

/**
 * 獲取當前用戶認證狀態
 * @returns 用戶認證狀態對象，包含是否在線、是否登錄以及當前用戶
 */
export const getCurrentUserAuthStatus = async (): Promise<{
  isOnline: boolean;
  isLoggedIn: boolean;
  currentUser: any;
}> => {
  // 檢查網絡連接狀態
  const isOnline = navigator.onLine;
  
  // 檢查用戶登錄狀態
  return new Promise((resolve) => {
    if (!auth) {
      // Firebase尚未初始化
      resolve({
        isOnline,
        isLoggedIn: false,
        currentUser: null
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // 立即取消訂閱，僅執行一次
      resolve({
        isOnline,
        isLoggedIn: !!user,
        currentUser: user
      });
    });
  });
}; 