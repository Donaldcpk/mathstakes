import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, addDoc, orderBy, limit, startAfter } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import toast from 'react-hot-toast';
import { Mistake } from '../types';
import { UserProfile } from '../types';

// Firebase 配置
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 初始化 Analytics (只在瀏覽器環境中運行)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };

// 提供者
export const googleProvider = new GoogleAuthProvider();

// 限制使用特定域名的帳號登入
googleProvider.setCustomParameters({
  hd: 'ngwahsec.edu.hk' // 學校域名
});

// 當前登入的用戶
let currentUser: User | null = null;

// 監聽用戶狀態變化
onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

// 獲取當前用戶
export const getCurrentUser = (): User | null => {
  return currentUser || auth.currentUser;
};

// 使用 Google 登入
export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('登入成功', result.user);
    toast.success('登入成功！');
    return result.user;
  } catch (error) {
    console.error('Google 登入錯誤', error);
    toast.error('登入失敗，請再試一次');
    return null;
  }
};

// 登出
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
    toast.success('成功登出');
  } catch (error) {
    console.error('登出錯誤', error);
    toast.error('登出失敗，請再試一次');
  }
};

// 獲取用戶錯題
export const getUserMistakes = async (userId: string): Promise<Mistake[]> => {
  try {
    console.time('firebase-fetch-mistakes');
    
    // 限制每次查詢數量並分頁
    const MAX_MISTAKES_PER_BATCH = 50;
    const mistakesRef = collection(db, 'mistakes');
    
    // 基本查詢：按用戶ID和創建時間降序
    let q = query(
      mistakesRef, 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(MAX_MISTAKES_PER_BATCH)
    );
    
    // 獲取第一批數據
    let snapshot = await getDocs(q);
    let allMistakes: Mistake[] = [];
    
    // 轉換數據
    snapshot.forEach(doc => {
      allMistakes.push({
        id: doc.id,
        ...doc.data()
      } as Mistake);
    });
    
    // 如果有更多數據，繼續獲取
    let lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    while (snapshot.docs.length === MAX_MISTAKES_PER_BATCH) {
      // 獲取下一批數據
      q = query(
        mistakesRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(MAX_MISTAKES_PER_BATCH)
      );
      
      snapshot = await getDocs(q);
      
      // 沒有更多數據則退出
      if (snapshot.empty) break;
      
      // 添加到結果列表
      snapshot.forEach(doc => {
        allMistakes.push({
          id: doc.id,
          ...doc.data()
        } as Mistake);
      });
      
      // 更新最後一個文檔引用
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    
    console.timeEnd('firebase-fetch-mistakes');
    console.log(`從 Firebase 獲取了 ${allMistakes.length} 條錯題記錄`);
    
    return allMistakes;
  } catch (error) {
    console.error('獲取用戶錯題失敗', error);
    toast.error('獲取錯題失敗，請重新嘗試');
    throw new Error('獲取錯題失敗');
  }
};

// 保存用戶錯題
export const saveUserMistake = async (userId: string, mistake: Omit<Mistake, 'id' | 'userId'>): Promise<Mistake | null> => {
  try {
    console.time('firebase-save-mistake');
    
    const mistakesRef = collection(db, 'mistakes');
    const mistakeData = {
      ...mistake,
      userId,
      createdAt: mistake.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString() // 添加更新時間欄位
    };
    
    const docRef = await addDoc(mistakesRef, mistakeData);
    console.log('錯題已儲存', docRef.id);
    console.timeEnd('firebase-save-mistake');
    
    toast.success('錯題已儲存');
    
    return {
      id: docRef.id,
      ...mistakeData
    };
  } catch (error) {
    console.error('儲存錯題失敗', error);
    toast.error('儲存錯題失敗，請再試一次');
    return null;
  }
};

// 更新用戶錯題
export const updateUserMistake = async (mistakeId: string, updateData: Partial<Omit<Mistake, 'id' | 'userId'>>): Promise<boolean> => {
  try {
    console.time('firebase-update-mistake');
    
    const mistakeRef = doc(db, 'mistakes', mistakeId);
    await updateDoc(mistakeRef, { 
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    
    console.log('錯題已更新', mistakeId);
    console.timeEnd('firebase-update-mistake');
    
    toast.success('錯題已更新');
    return true;
  } catch (error) {
    console.error('更新錯題失敗', error);
    toast.error('更新錯題失敗，請再試一次');
    return false;
  }
};

// 刪除用戶錯題
export const deleteUserMistake = async (mistakeId: string): Promise<boolean> => {
  try {
    console.time('firebase-delete-mistake');
    
    const mistakeRef = doc(db, 'mistakes', mistakeId);
    await deleteDoc(mistakeRef);
    
    console.log('錯題已刪除', mistakeId);
    console.timeEnd('firebase-delete-mistake');
    
    toast.success('錯題已刪除');
    return true;
  } catch (error) {
    console.error('刪除錯題失敗', error);
    toast.error('刪除錯題失敗，請再試一次');
    return false;
  }
};

// 獲取用戶資料
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    } else {
      console.log('用戶資料不存在');
      return null;
    }
  } catch (error) {
    console.error('獲取用戶資料失敗', error);
    toast.error('獲取用戶資料失敗');
    return null;
  }
};

// 保存用戶資料
export const saveUserProfile = async (profile: UserProfile): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', profile.uid);
    await setDoc(userRef, {
      ...profile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log('用戶資料已儲存');
    return true;
  } catch (error) {
    console.error('儲存用戶資料失敗', error);
    toast.error('儲存用戶資料失敗，請重試');
    return false;
  }
};

// 檢查用戶資料是否完整
export const isUserProfileComplete = async (userId: string): Promise<boolean> => {
  const profile = await getUserProfile(userId);
  return profile !== null && profile.isProfileComplete === true;
}; 