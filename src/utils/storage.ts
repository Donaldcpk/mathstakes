import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { Mistake, ErrorType, EducationLevel, TopicCategory } from '../types';
import { auth, getCurrentUser, saveUserMistake, getUserMistakes, updateUserMistake, deleteUserMistake } from './firebase';
import { isOnline } from './networkRetry';
import { toast } from 'react-hot-toast';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { markForSync as markItemForSync, syncOfflineChanges as syncOfflineChangesFromManager } from './syncManager';

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
    console.log(`開始刪除錯題 ID: ${id}`);
    let localDeleteSuccess = false;
    let cloudDeleteSuccess = false;
    
    // 先從本地存儲刪除
    try {
      const mistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
      const filteredMistakes = mistakes.filter(mistake => mistake.id !== id);
      await localforage.setItem(MISTAKES_KEY, filteredMistakes);
      
      // 更新緩存
      if (cachedMistakes) {
        cachedMistakes = cachedMistakes.filter(mistake => mistake.id !== id);
        lastCacheTime = Date.now();
      }
      
      localDeleteSuccess = true;
      console.log(`本地刪除錯題 ID: ${id} 成功`);
    } catch (localError) {
      console.error(`本地刪除錯題 ID: ${id} 失敗:`, localError);
      // 即使本地刪除失敗，仍嘗試雲端刪除
    }
    
    // 如果用戶已登入，從Firebase刪除
    if (isUserLoggedIn()) {
      const userId = getUserId();
      if (userId) {
        try {
          const success = await deleteUserMistake(id);
          if (success) {
            cloudDeleteSuccess = true;
            console.log(`雲端刪除錯題 ID: ${id} 成功`);
          } else {
            console.warn(`雲端刪除錯題 ID: ${id} 失敗，可能是權限問題或者錯題不存在`);
            // 錯題已從本地刪除但雲端刪除失敗，將其標記為待同步
            await markForSync(`mistake_delete_${id}`);
          }
        } catch (cloudError) {
          console.error(`雲端刪除錯題 ID: ${id} 發生錯誤:`, cloudError);
          // 將刪除操作標記為待同步
          await markForSync(`mistake_delete_${id}`);
        }
      }
    } else {
      // 未登入時默認雲端刪除成功
      cloudDeleteSuccess = true;
    }
    
    // 有一個成功就算成功
    const isDeleteSuccessful = localDeleteSuccess || cloudDeleteSuccess;
    
    // 提供更詳細的日誌
    if (localDeleteSuccess && cloudDeleteSuccess) {
      console.log(`錯題 ID: ${id} 已完全刪除（本地和雲端）`);
      toast.success('錯題已刪除');
    } else if (localDeleteSuccess) {
      console.log(`錯題 ID: ${id} 已從本地刪除，但雲端刪除失敗或未登入`);
      toast.success('錯題已從本地刪除');
      // 如果用戶已登入但雲端刪除失敗，顯示警告
      if (isUserLoggedIn()) {
        toast.error('雲端同步失敗，將在下次連線時重試');
      }
    } else if (cloudDeleteSuccess) {
      console.log(`錯題 ID: ${id} 已從雲端刪除，但本地刪除失敗`);
      toast.success('錯題已從雲端刪除');
      toast.error('本地存儲可能有問題，請重新整理頁面');
    } else {
      console.error(`錯題 ID: ${id} 刪除完全失敗`);
      toast.error('刪除失敗，請重試');
      return false;
    }
    
    return isDeleteSuccessful;
  } catch (error) {
    console.error(`無法刪除錯題 ID ${id}:`, error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    toast.error(`刪除錯題失敗: ${errorMessage}`);
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

// 添加離線同步標記
// 這個函數保留以向後兼容，但內部使用syncManager
export async function markForSync(key: string): Promise<void> {
  try {
    await markItemForSync(key);
  } catch (error) {
    console.error('標記同步失敗:', error);
  }
}

/**
 * 同步離線變更到雲端
 * 在恢復網絡連接後調用
 * @deprecated 請使用 syncManager.syncOfflineChanges
 */
export async function syncOfflineChanges(): Promise<void> {
  try {
    // 使用syncManager中的實現
    await syncOfflineChangesFromManager();
  } catch (error) {
    console.error('同步離線變更失敗:', error);
    toast.error('同步失敗，請稍後再試');
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

// 獲取錯題數量
export const getMistakesCount = (): number => {
  return getMistakes().length;
};

// 根據 ID 獲取特定錯題
export const getMistakeById = (id: string): Mistake | undefined => {
  const mistakes = getMistakes();
  return mistakes.find(mistake => mistake.id === id);
};

/**
 * 批量保存錯題（用於CSV導入）
 * @param mistakes 要保存的錯題數組
 * @returns 返回成功導入的錯題數量和錯誤信息
 */
export const bulkSaveMistakes = async (
  mistakes: Partial<Mistake>[]
): Promise<{success: boolean; importedCount: number; errors: string[]}> => {
  if (!mistakes || mistakes.length === 0) {
    return { success: false, importedCount: 0, errors: ['沒有可匯入的錯題'] };
  }
  
  const errors: string[] = [];
  let importedCount = 0;
  const savedIds: string[] = [];
  
  try {
    console.log(`準備批量匯入 ${mistakes.length} 個錯題`);
    
    // 獲取現有的錯題
    const existingMistakes = await localforage.getItem<Mistake[]>(MISTAKES_KEY) || [];
    const updatedMistakes: Mistake[] = [...existingMistakes];

    // 處理每一個錯題
    for (let i = 0; i < mistakes.length; i++) {
      const item = mistakes[i];
      
      try {
        // 驗證必填欄位
        if (!item.title || !item.content || !item.subject) {
          errors.push(`第 ${i+1} 項缺少必要欄位 (title, content, subject 為必填)`);
          continue;
        }

        // 建立完整的錯題物件
        const newMistake: Mistake = {
          id: item.id || uuidv4(),
          title: item.title,
          content: item.content,
          subject: item.subject,
          educationLevel: item.educationLevel || EducationLevel.JUNIOR,
          errorType: item.errorType || ErrorType.UNKNOWN,
          explanation: item.explanation || '',
          errorSteps: item.errorSteps || '',
          userAnswer: item.userAnswer || '',
          correctAnswer: item.correctAnswer || '',
          createdAt: item.createdAt || new Date().toISOString(),
          lastReviewedAt: item.lastReviewedAt || '',
          reviewCount: item.reviewCount || 0,
          tags: item.tags || [],
          imageUrl: item.imageUrl || '',
          status: item.status || 'active',
          topicCategory: item.topicCategory || TopicCategory.NUMBER_ALGEBRA
        };

        // 檢查是否有重複ID
        const existingIndex = updatedMistakes.findIndex(m => m.id === newMistake.id);
        if (existingIndex !== -1) {
          // 更新現有錯題
          updatedMistakes[existingIndex] = {
            ...updatedMistakes[existingIndex],
            ...newMistake
          };
          console.log(`更新現有錯題: ${newMistake.id}`);
        } else {
          // 添加新錯題
          updatedMistakes.push(newMistake);
          console.log(`添加新錯題: ${newMistake.id}`);
        }

        savedIds.push(newMistake.id);
        importedCount++;
        
      } catch (itemError) {
        console.error('處理錯題項目時出錯:', itemError);
        errors.push(`第 ${i+1} 項處理失敗: ${(itemError as Error).message}`);
      }
    }

    // 批量保存到本地存儲
    if (importedCount > 0) {
      console.log(`保存 ${importedCount} 個錯題到本地存儲`);
      await localforage.setItem(MISTAKES_KEY, updatedMistakes);
      
      // 更新緩存
      cachedMistakes = updatedMistakes;
      lastCacheTime = Date.now();
      
      // 如果用戶已登入，將新錯題同步到雲端
      if (isUserLoggedIn() && isOnline()) {
        const userId = getUserId();
        if (userId) {
          console.log('正在同步匯入的錯題到雲端...');
          try {
            // 獲取所有已匯入的錯題
            const importedMistakes = updatedMistakes.filter(m => savedIds.includes(m.id));
            
            // 在Firebase中批量保存
            for (const mistake of importedMistakes) {
              await setDoc(doc(db, `users/${userId}/mistakes/${mistake.id}`), mistake);
            }
            console.log('匯入的錯題已同步到雲端');
          } catch (syncError) {
            console.error('同步到雲端失敗:', syncError);
            errors.push(`同步到雲端失敗: ${(syncError as Error).message}，但錯題已保存在本地`);
            // 將未同步的項目標記為需要同步
            for (const id of savedIds) {
              await markForSync(`mistake:${id}`);
            }
          }
        }
      } else if (isUserLoggedIn()) {
        // 標記為離線，稍後同步
        console.log('離線狀態，標記錯題為待同步');
        for (const id of savedIds) {
          await markForSync(`mistake:${id}`);
        }
      }
      
      // 觸發更新事件
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mistakesUpdated', { 
          detail: { mistakes: updatedMistakes } 
        }));
      }
      
      return { success: true, importedCount, errors };
    } else {
      return { success: false, importedCount: 0, errors: [...errors, '批量導入失敗: 沒有符合要求的錯題'] };
    }
  } catch (error) {
    console.error('批量保存錯題出錯:', error);
    return { 
      success: false, 
      importedCount, 
      errors: [...errors, `批量導入失敗: ${(error as Error).message}`] 
    };
  }
}; 