import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { Mistake, ErrorType, EducationLevel, TopicCategory } from '../types';
import { auth, getCurrentUser, saveUserMistake, getUserMistakes, updateUserMistake, deleteUserMistake } from './firebase';
import { isOnline, waitForNetwork } from './networkRetry';
import { toast } from 'react-hot-toast';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// 初始化 localforage
localforage.config({
  name: 'mathstakes',
  storeName: 'mistakes',
  description: '儲存數學錯題資料'
});

// 緩存機制
let cachedMistakes: Mistake[] | null = null;
const cacheExpiration = 5 * 60 * 1000; // 5分鐘緩存
let lastCacheTime = 0;

// 清除緩存的函數
export const clearMistakesCache = () => {
  cachedMistakes = null;
  lastCacheTime = 0;
  console.log('已清除錯題緩存');
};

// 設置自動背景同步的標記
let isSyncingInBackground = false;

// 常數 
const MISTAKES_KEY = 'mistakes';
const SAMPLE_DATA_KEY = 'sample_data_initialized';

// 檢查用戶是否已登入
export const isUserLoggedIn = (): boolean => {
  return auth?.currentUser !== null;
};

// 獲取用戶ID
export const getUserId = (): string | null => {
  const user = getCurrentUser();
  return user ? user.uid : null;
};

// 獲取所有錯題
export const getMistakes = async (): Promise<Mistake[]> => {
  try {
    // 檢查緩存
    const now = Date.now();
    if (cachedMistakes && (now - lastCacheTime < cacheExpiration)) {
      console.log('從緩存獲取錯題列表');
      return cachedMistakes;
    }
    
    // 先嘗試從本地獲取
    const localMistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
    
    // 如果本地有數據，立即返回並在背景更新
    if (localMistakes.length > 0 && !isSyncingInBackground) {
      // 更新緩存
      cachedMistakes = localMistakes;
      lastCacheTime = now;
      
      // 在背景更新雲端數據（不阻塞UI）
      if (isUserLoggedIn()) {
        const userId = getUserId();
        if (userId) {
          isSyncingInBackground = true;
          console.log('在背景同步雲端錯題數據');
          getUserMistakes(userId).then(cloudMistakes => {
            // 更新本地存儲
            localforage.setItem(MISTAKES_KEY, cloudMistakes);
            // 更新緩存
            cachedMistakes = cloudMistakes;
            lastCacheTime = Date.now();
            // 如果組件仍然掛載，觸發更新事件
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mistakesUpdated', { 
                detail: { mistakes: cloudMistakes } 
              }));
            }
          }).catch(console.error)
          .finally(() => {
            isSyncingInBackground = false;
          });
        }
      }
      return localMistakes;
    }

    // 新增超時處理
    const timeoutPromise = new Promise<Mistake[]>((_, reject) => {
      setTimeout(() => reject(new Error('獲取錯題超時，請重新嘗試')), 20000); // 增加到20秒
    });

    // 主要資料獲取邏輯
    const dataPromise = async (): Promise<Mistake[]> => {
      // 如果用戶已登入，從Firebase獲取資料
      if (isUserLoggedIn()) {
        const userId = getUserId();
        if (userId) {
          const cloudMistakes = await getUserMistakes(userId);
          // 更新緩存
          cachedMistakes = cloudMistakes;
          lastCacheTime = now;
          // 更新本地存儲
          await localforage.setItem(MISTAKES_KEY, cloudMistakes);
          return cloudMistakes;
        }
      }
      
      // 否則從本地存儲獲取
      const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
      // 更新緩存
      cachedMistakes = mistakes;
      lastCacheTime = now;
      return mistakes;
    };
    
    // 使用 Promise.race 實現超時控制
    return await Promise.race([dataPromise(), timeoutPromise]);
  } catch (error) {
    console.error('獲取錯題資料失敗:', error);
    
    // 如果出錯，嘗試從本地獲取資料作為備份
    try {
      const backupData = await localforage.getItem<Mistake[]>(MISTAKES_KEY);
      if (backupData && backupData.length > 0) {
        console.log('從本地備份獲取錯題資料');
        return backupData;
      }
    } catch (localError) {
      console.error('從本地備份獲取錯題資料失敗:', localError);
    }
    
    // 添加更明確的錯誤處理
    if (error instanceof Error && error.message.includes('超時')) {
      throw new Error('載入錯題資料超時，請檢查您的網路連接並重新嘗試');
    }
    throw new Error('無法獲取錯題資料，請稍後再試');
  }
};

// 獲取單個錯題
export const getMistake = async (id: string): Promise<Mistake | null> => {
  try {
    // 先從緩存中查找
    if (cachedMistakes) {
      const cachedMistake = cachedMistakes.find(mistake => mistake.id === id);
      if (cachedMistake) {
        console.log(`從緩存中獲取錯題ID ${id}`);
        return cachedMistake;
      }
    }
    
    // 再從本地存儲查找
    const localMistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
    const localMistake = localMistakes.find(mistake => mistake.id === id);
    
    if (localMistake) {
      console.log(`從本地存儲中獲取錯題ID ${id}`);
      return localMistake;
    }

    // 新增超時處理
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('獲取錯題超時，請重新嘗試')), 20000); // 增加到20秒
    });

    // 主要資料獲取邏輯
    const dataPromise = async (): Promise<Mistake | null> => {
      // 不管是否登入，都從獲取所有錯題中查找
      const mistakes = await getMistakes();
      return mistakes.find(mistake => mistake.id === id) || null;
    };
    
    // 使用 Promise.race 實現超時控制
    return await Promise.race([dataPromise(), timeoutPromise]);
  } catch (error) {
    console.error(`無法獲取錯題 ID ${id}:`, error);
    if (error instanceof Error && error.message.includes('超時')) {
      throw new Error('載入錯題詳情超時，請檢查您的網路連接並重新嘗試');
    }
    throw new Error(`無法獲取錯題詳情，請稍後再試`);
  }
};

// 保存錯題
export const saveNewMistake = async (
  mistake: Omit<Mistake, 'id' | 'createdAt'> & { createdAt?: string | Date }
): Promise<Mistake> => {
  try {
    // 最多重試3次
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        // 準備新錯題的數據
        const newMistake: Mistake = {
          ...mistake,
          id: uuidv4(),
          createdAt: mistake.createdAt instanceof Date ? 
            mistake.createdAt.toISOString() : 
            (mistake.createdAt ? new Date(mistake.createdAt).toISOString() : new Date().toISOString())
        };
        
        // 如果用戶已登入，保存到Firebase
        if (isUserLoggedIn()) {
          const userId = getUserId();
          if (userId) {
            const savedMistake = await saveUserMistake(userId, {
              ...mistake,
              createdAt: newMistake.createdAt
            });
            
            if (savedMistake) {
              // 額外保存一份到本地作為備份
              try {
                const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
                const updatedMistakes = [...mistakes, savedMistake];
                await localforage.setItem(MISTAKES_KEY, updatedMistakes);
                
                // 更新緩存
                cachedMistakes = updatedMistakes;
                lastCacheTime = Date.now();
              } catch (localError) {
                console.warn('本地備份儲存失敗，但雲端儲存成功', localError);
              }
              
              return savedMistake;
            }
          }
        }
        
        // 否則保存到本地存儲
        const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
        const updatedMistakes = [...mistakes, newMistake];
        await localforage.setItem(MISTAKES_KEY, updatedMistakes);
        
        // 更新緩存
        cachedMistakes = updatedMistakes;
        lastCacheTime = Date.now();
        
        return newMistake;
      } catch (attemptError) {
        console.error(`保存錯題嘗試 ${retryCount + 1}/${maxRetries} 失敗:`, attemptError);
        retryCount++;
        
        // 如果達到最大重試次數，則拋出錯誤
        if (retryCount >= maxRetries) throw attemptError;
        
        // 否則等待一段時間再重試，每次等待時間增加
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    
    // 防止TypeScript報錯，這行代碼實際上不會執行
    throw new Error('達到最大重試次數');
  } catch (error) {
    console.error('無法保存錯題:', error);
    throw new Error('儲存錯題失敗，請再試一次');
  }
};

// 更新錯題
export const updateMistake = async (id: string, updates: Partial<Mistake>): Promise<Mistake | null> => {
  try {
    // 如果用戶已登入，更新Firebase
    if (isUserLoggedIn()) {
      const success = await updateUserMistake(id, updates);
      if (success) {
        // 更新緩存
        if (cachedMistakes) {
          const index = cachedMistakes.findIndex(mistake => mistake.id === id);
          if (index !== -1) {
            cachedMistakes[index] = { ...cachedMistakes[index], ...updates };
            lastCacheTime = Date.now();
          }
        }
        
        // 更新本地存儲
        const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
        const index = mistakes.findIndex(mistake => mistake.id === id);
        if (index !== -1) {
          mistakes[index] = { ...mistakes[index], ...updates };
          await localforage.setItem(MISTAKES_KEY, mistakes);
        }
        
        return getMistake(id);
      }
    }
    
    // 否則更新本地存儲
    const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
    const index = mistakes.findIndex(mistake => mistake.id === id);
    
    if (index === -1) {
      return null;
    }
    
    const updatedMistake = { ...mistakes[index], ...updates };
    mistakes[index] = updatedMistake;
    
    await localforage.setItem(MISTAKES_KEY, mistakes);
    
    // 更新緩存
    if (cachedMistakes) {
      const cacheIndex = cachedMistakes.findIndex(mistake => mistake.id === id);
      if (cacheIndex !== -1) {
        cachedMistakes[cacheIndex] = updatedMistake;
        lastCacheTime = Date.now();
      }
    }
    
    return updatedMistake;
  } catch (error) {
    console.error(`無法更新錯題 ID ${id}:`, error);
    throw new Error('更新錯題失敗');
  }
};

// 刪除錯題
export const deleteMistake = async (id: string): Promise<boolean> => {
  try {
    // 如果用戶已登入，從Firebase刪除
    if (isUserLoggedIn()) {
      const success = await deleteUserMistake(id);
      if (success) {
        // 更新緩存
        if (cachedMistakes) {
          cachedMistakes = cachedMistakes.filter(mistake => mistake.id !== id);
          lastCacheTime = Date.now();
        }
        
        // 更新本地存儲
        const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
        const filteredMistakes = mistakes.filter(mistake => mistake.id !== id);
        await localforage.setItem(MISTAKES_KEY, filteredMistakes);
        return true;
      }
    }
    
    // 否則從本地存儲刪除
    const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
    const filteredMistakes = mistakes.filter(mistake => mistake.id !== id);
    
    await localforage.setItem(MISTAKES_KEY, filteredMistakes);
    
    // 更新緩存
    if (cachedMistakes) {
      cachedMistakes = cachedMistakes.filter(mistake => mistake.id !== id);
      lastCacheTime = Date.now();
    }
    
    return true;
  } catch (error) {
    console.error(`無法刪除錯題 ID ${id}:`, error);
    return false;
  }
};

// 添加AI解釋
export const addExplanation = async (id: string, explanation: string): Promise<Mistake | null> => {
  return updateMistake(id, { explanation });
};

// 檢查並初始化示例資料
let isInitializing = false;

export const initializeSampleData = async (): Promise<void> => {
  try {
    // 防止多次同時初始化
    if (isInitializing) {
      console.log('正在初始化示例資料，請勿重複操作');
      return;
    }
    
    // 檢查是否已初始化
    const isInitialized = await localforage.getItem<boolean>(SAMPLE_DATA_KEY);
    if (isInitialized) {
      return;
    }
    
    isInitializing = true;
    
    // 檢查當前錯題數量，如果已經有錯題，則不初始化
    const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY);
    if (mistakes && mistakes.length > 0) {
      // 標記為已初始化
      await localforage.setItem(SAMPLE_DATA_KEY, true);
      isInitializing = false;
      return;
    }
    
    // 初始化示例資料
    const sampleMistakes: Omit<Mistake, 'id' | 'createdAt'>[] = [
      {
        title: '分數運算錯誤',
        content: '計算 1/2 + 1/3 = ?',
        subject: '代數',
        educationLevel: EducationLevel.JUNIOR,
        topicCategory: TopicCategory.NUMBER_ALGEBRA,
        errorType: ErrorType.CONCEPT_ERROR,
        errorSteps: '我直接把分子和分母相加: 1/2 + 1/3 = 2/5',
        explanation: '這是一個常見的分數加法錯誤。\n\n正確計算方式是找最小公分母：\n1/2 + 1/3 = 3/6 + 2/6 = 5/6\n\n你的錯誤在於直接把分子加分子、分母加分母，這是不正確的。分數加法需要先將分母轉換為相同的值，再進行分子相加。'
      },
      {
        title: '計算機使用錯誤',
        content: '計算 log₁₀(0.01)',
        subject: '代數',
        educationLevel: EducationLevel.SENIOR,
        topicCategory: TopicCategory.NUMBER_ALGEBRA,
        errorType: ErrorType.CALCULATOR_ERROR,
        errorSteps: '在計算機中輸入時，忘記輸入小數點',
        explanation: '這題是關於對數的計算，正確答案是 -2。\n\nlog₁₀(0.01) = log₁₀(1/100) = log₁₀(10⁻²) = -2\n\n你在計算機中可能遇到的問題：\n1. 忘記輸入小數點，將 0.01 輸入成 1 或其他數字\n2. 使用了錯誤的對數函數（如使用 ln 而非 log）\n\n避免這類錯誤的方法：\n- 使用計算機前核對模式和功能\n- 輸入後檢查屏幕上顯示的數字\n- 對於簡單的對數計算，可以先用特性估算結果範圍'
      }
    ];
    
    // 添加示例資料
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    // 分散儲存時間，使示例資料看起來更自然
    for (let i = 0; i < sampleMistakes.length; i++) {
      const date = i === 0 ? lastMonth : lastWeek;
      await saveNewMistake({
        ...sampleMistakes[i],
        createdAt: date
      });
    }
    
    // 標記為已初始化
    await localforage.setItem(SAMPLE_DATA_KEY, true);
  } catch (error) {
    console.error('初始化示例資料失敗:', error);
  } finally {
    isInitializing = false;
  }
};

/**
 * 添加離線同步標記
 * @param key 同步對象的鍵
 */
export async function markForSync(key: string): Promise<void> {
  const syncQueue = await localforage.getItem<string[]>('sync_queue') || [];
  if (!syncQueue.includes(key)) {
    syncQueue.push(key);
    await localforage.setItem('sync_queue', syncQueue);
    console.log(`已將項目標記為待同步: ${key}`);
  }
}

/**
 * 同步離線變更到雲端
 * 在恢復網絡連接後調用
 */
export async function syncOfflineChanges(): Promise<void> {
  if (!isOnline()) {
    console.log('離線狀態，無法同步');
    return;
  }

  const syncQueue = await localforage.getItem<string[]>('sync_queue') || [];
  if (syncQueue.length === 0) {
    console.log('沒有待同步的項目');
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    console.log('用戶未登入，無法同步到雲端');
    return;
  }

  console.log(`開始同步 ${syncQueue.length} 個離線變更`);
  toast.loading(`正在同步資料...`, { id: 'sync-toast' });

  const failedItems: string[] = [];
  
  for (const key of syncQueue) {
    try {
      // 處理不同類型的同步
      if (key.startsWith('mistake_')) {
        const mistakeId = key.replace('mistake_', '');
        const mistake = await getMistake(mistakeId);
        
        if (mistake) {
          await saveMistakeToCloud(mistake);
          console.log(`成功同步錯題: ${mistakeId}`);
        }
      }
      // 可以添加其他類型的同步處理
      
    } catch (error) {
      console.error(`同步項目失敗: ${key}`, error);
      failedItems.push(key);
    }
  }

  // 更新同步隊列，只保留失敗的項目
  if (failedItems.length > 0) {
    await localforage.setItem('sync_queue', failedItems);
    toast.error(`同步完成，但有 ${failedItems.length} 個項目失敗`, { id: 'sync-toast' });
  } else {
    await localforage.setItem('sync_queue', []);
    toast.success('所有資料同步完成', { id: 'sync-toast' });
  }
}

/**
 * 保存錯題到本地儲存和離線隊列
 * 用於PWA離線功能
 */
export async function saveOfflineMistake(mistake: Mistake, createdAt?: string): Promise<string> {
  try {
    // 準備錯題數據
    const mistakeId = mistake.id || uuidv4();
    const finalMistake = {
      ...mistake,
      id: mistakeId,
      createdAt: createdAt || new Date().toISOString()
    };

    // 添加到本地儲存
    let mistakes = await localforage.getItem<Record<string, Mistake>>('mistakes') || {};
    mistakes[mistakeId] = finalMistake;
    await localforage.setItem('mistakes', mistakes);

    // 如果在線並且用戶已登入，嘗試保存到雲端
    const user = getCurrentUser();
    if (isOnline() && user) {
      try {
        await saveMistakeToCloud(finalMistake);
      } catch (error) {
        console.error('保存到雲端失敗，已標記為待同步', error);
        await markForSync(`mistake_${mistakeId}`);
      }
    } else if (!isOnline()) {
      // 離線狀態，標記為待同步
      await markForSync(`mistake_${mistakeId}`);
      toast.success('錯題已保存（離線模式）', {
        duration: 2000,
        icon: '📴'
      });
    }

    return mistakeId;
  } catch (error) {
    console.error('保存錯題失敗', error);
    toast.error('保存錯題失敗，請再試一次');
    throw error;
  }
}

/**
 * 保存錯題到雲端
 */
async function saveMistakeToCloud(mistake: Mistake): Promise<void> {
  const user = getCurrentUser();
  if (!user || !db) return;

  const mistakeRef = doc(db, 'users', user.uid, 'mistakes', mistake.id);
  await setDoc(mistakeRef, {
    ...mistake,
    updatedAt: new Date().toISOString()
  });
}

// 監聽網絡狀態變化，自動同步
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('網絡連接已恢復，開始同步資料');
    // 延遲一下確保連接穩定
    setTimeout(syncOfflineChanges, 3000);
  });
} 