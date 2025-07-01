import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged, User, signInWithRedirect, getRedirectResult as firebaseGetRedirectResult, signInWithPopup } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, getDocs, addDoc, orderBy, limit, startAfter } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import toast from 'react-hot-toast';
import { Mistake } from '../types';
import { UserProfile } from '../types';

// Firebase 配置
// 注意：Firebase 設計為可在客戶端使用，這些配置實際上不是秘密
// https://firebase.google.com/docs/projects/api-keys
const firebaseConfig = {
  apiKey: "AIzaSyBvSo54fPYT11tDeVkdC4mTgP2HqsgMb28",
  authDomain: "mathstakes-app.firebaseapp.com",
  projectId: "mathstakes-app",
  storageBucket: "mathstakes-app.firebasestorage.app",
  messagingSenderId: "73353927746",
  appId: "1:73353927746:web:44d2814fe3c0e81b2161db",
  measurementId: "G-PFEBG1ZN30"
};

// 初始化 Firebase
let app;
try {
  console.log('嘗試初始化 Firebase', JSON.stringify(firebaseConfig, null, 2));
  app = initializeApp(firebaseConfig);
  console.log('Firebase 初始化成功');
} catch (error) {
  console.error('Firebase 初始化失敗:', error);
  // 添加錯誤處理，防止應用崩潰
  app = null;
}

// 初始化服務
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;

// 初始化 Analytics (只在瀏覽器環境中運行)
let analytics = null;
if (typeof window !== 'undefined' && app) {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.error('Firebase Analytics 初始化失敗:', error);
  }
}
export { analytics };

// 提供者
export const googleProvider = new GoogleAuthProvider();
// 添加自定義參數，確保登入流程順暢
googleProvider.setCustomParameters({
  prompt: 'select_account',
  // 允許任何Google帳號登入
  hd: '*'
});

// 當前登入的用戶
let currentUser: User | null = null;

// 監聽用戶狀態變化
if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });
}

// 獲取當前用戶
export const getCurrentUser = (): User | null => {
  return currentUser || (auth ? auth.currentUser : null);
};

// 使用 Google 登入
export const signInWithGoogle = async (): Promise<User | null> => {
  if (!auth || !googleProvider) {
    console.error('Firebase 認證服務未初始化');
    toast.error('登入服務未初始化，請重新載入頁面');
    return null;
  }

  try {
    console.log('開始 Google 登入流程...');
    
    // 嘗試使用彈出窗口方式登入
    try {
      console.log('嘗試使用彈出窗口登入');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('彈出窗口登入成功', result.user.email);
      toast.success('登入成功！');
      return result.user;
    } catch (popupError) {
      console.error('彈出窗口登入失敗，嘗試重定向方式', popupError);
      
      // 如果彈出窗口失敗，使用重定向方式
      await signInWithRedirect(auth, googleProvider);
      console.log('已重定向到 Google 登入頁面');
      return null; // 重定向後會離開頁面，所以返回 null
    }
  } catch (error) {
    console.error('Google 登入錯誤', error);
    toast.error('登入失敗，請再試一次：' + (error instanceof Error ? error.message : '未知錯誤'));
    return null;
  }
};

// 登出
export const signOut = async (): Promise<void> => {
  if (!auth) {
    console.error('Firebase 認證服務未初始化');
    toast.error('登出服務未初始化');
    return;
  }

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
  if (!db) {
    console.error('Firebase 數據庫服務未初始化');
    toast.error('數據服務未初始化，請重新載入頁面');
    return [];
  }

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
  if (!db) {
    console.error('Firebase 數據庫服務未初始化');
    toast.error('無法保存錯題，服務未初始化');
    return null;
  }

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
  if (!db) {
    console.error('Firebase 數據庫服務未初始化');
    toast.error('無法更新錯題，服務未初始化');
    return false;
  }

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
  if (!db) {
    console.error('Firebase 數據庫服務未初始化');
    toast.error('無法刪除錯題，服務未初始化');
    return false;
  }

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
  if (!db) {
    console.error('Firebase 數據庫服務未初始化');
    toast.error('無法獲取用戶資料，服務未初始化');
    return null;
  }

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
  if (!db) {
    console.error('Firebase 數據庫服務未初始化');
    toast.error('無法保存用戶資料，服務未初始化');
    return false;
  }

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

// 匯出 getRedirectResult 函數，用於處理重定向登入結果
export const getRedirectResult = async (auth: any) => {
  if (!auth) {
    console.error('Firebase 認證服務未初始化');
    return null;
  }
  
  try {
    return await firebaseGetRedirectResult(auth);
  } catch (error) {
    console.error('獲取重定向結果失敗:', error);
    throw error;
  }
};

// ==================== 圖片儲存功能 ====================

// 上傳錯題圖片到 Firebase Storage
export const uploadMistakeImage = async (file: File, userId: string): Promise<string | null> => {
  if (!storage) {
    console.error('Firebase Storage 服務未初始化');
    toast.error('圖片上傳服務未初始化');
    return null;
  }

  try {
    // 驗證檔案類型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('只支援 JPG、PNG、WebP 格式的圖片');
      return null;
    }

    // 檢查檔案大小（限制 5MB）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('圖片檔案不能超過 5MB');
      return null;
    }

    // 生成唯一檔案名稱
    const timestamp = Date.now();
    const fileName = `mistake-${timestamp}-${Math.random().toString(36).substring(2, 15)}.${file.name.split('.').pop()}`;
    const imagePath = `mistakes/${userId}/${fileName}`;
    
    console.log('開始上傳圖片:', imagePath);
    console.time('upload-image');
    
    // 建立檔案引用並上傳
    const imageRef = ref(storage, imagePath);
    const snapshot = await uploadBytes(imageRef, file);
    
    // 獲取下載URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.timeEnd('upload-image');
    console.log('圖片上傳成功:', downloadURL);
    
    toast.success('圖片上傳成功');
    return downloadURL;
  } catch (error) {
    console.error('圖片上傳失敗:', error);
    toast.error('圖片上傳失敗，請重試');
    return null;
  }
};

// 刪除錯題圖片
export const deleteMistakeImage = async (imageUrl: string): Promise<boolean> => {
  if (!storage || !imageUrl) {
    return false;
  }

  try {
    // 從URL提取檔案路徑
    const url = new URL(imageUrl);
    const pathStart = url.pathname.indexOf('/o/') + 3;
    const pathEnd = url.pathname.indexOf('?');
    const filePath = decodeURIComponent(url.pathname.substring(pathStart, pathEnd));
    
    console.log('嘗試刪除圖片:', filePath);
    
    // 建立檔案引用並刪除
    const imageRef = ref(storage, filePath);
    await deleteObject(imageRef);
    
    console.log('圖片刪除成功');
    return true;
  } catch (error) {
    console.error('刪除圖片失敗:', error);
    // 不顯示錯誤訊息，因為圖片可能已經不存在
    return false;
  }
};

// 壓縮圖片 (可選功能，用於節省儲存空間)
export const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // 計算新的尺寸
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      // 設置畫布尺寸
      canvas.width = width;
      canvas.height = height;
      
      // 繪製壓縮後的圖片
      ctx?.drawImage(img, 0, 0, width, height);
      
      // 轉換為Blob並建立新的檔案
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        } else {
          resolve(file); // 如果壓縮失敗，返回原檔案
        }
      }, file.type, quality);
    };
    
    img.src = URL.createObjectURL(file);
  });
}; 