import localforage from 'localforage';
import { isUserLoggedIn, getUserId } from './storage';
import { deleteUserMistake } from './firebase';
import { toast } from 'react-hot-toast';

/**
 * 同步管理器 - 處理離線時的操作同步
 */

// 同步類型枚舉
export enum SyncType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

// 同步隊列鍵
const SYNC_QUEUE_KEY = 'sync_queue';

/**
 * 獲取待同步項目列表
 */
export const getSyncQueue = async (): Promise<string[]> => {
  return await localforage.getItem<string[]>(SYNC_QUEUE_KEY) || [];
};

/**
 * 將項目標記為待同步
 * @param key 同步對象的鍵
 * @returns 是否成功標記
 */
export async function markForSync(key: string): Promise<boolean> {
  try {
    const syncQueue = await localforage.getItem<string[]>(SYNC_QUEUE_KEY) || [];
    if (!syncQueue.includes(key)) {
      syncQueue.push(key);
      await localforage.setItem(SYNC_QUEUE_KEY, syncQueue);
      console.log(`已將項目標記為待同步: ${key}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('標記同步失敗:', error);
    return false;
  }
}

/**
 * 從同步隊列中移除項目
 * @param key 要移除的鍵
 */
export async function removeFromSyncQueue(key: string): Promise<boolean> {
  try {
    const syncQueue = await localforage.getItem<string[]>(SYNC_QUEUE_KEY) || [];
    const updatedQueue = syncQueue.filter(item => item !== key);
    await localforage.setItem(SYNC_QUEUE_KEY, updatedQueue);
    console.log(`已從同步隊列移除: ${key}`);
    return true;
  } catch (error) {
    console.error('從同步隊列移除失敗:', error);
    return false;
  }
}

/**
 * 檢查網絡連接
 * @returns {boolean} 是否在線
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === true;
}

/**
 * 同步離線變更到雲端
 * 在恢復網絡連接或用戶登入後調用
 */
export async function syncOfflineChanges(): Promise<{ 
  success: boolean; 
  syncedCount: number; 
  failedCount: number;
  remainingCount: number;
}> {
  if (!isOnline()) {
    console.log('離線狀態，無法同步');
    return { success: false, syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  // 檢查用戶是否已登入
  if (!isUserLoggedIn()) {
    console.log('用戶未登入，無法同步到雲端');
    return { success: false, syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  const syncQueue = await getSyncQueue();
  if (syncQueue.length === 0) {
    console.log('沒有待同步的項目');
    return { success: true, syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  console.log(`開始同步 ${syncQueue.length} 個離線變更`);
  const syncToastId = toast.loading(`正在同步資料...`);

  // 用戶ID
  const userId = getUserId();
  if (!userId) {
    toast.error('無法獲取用戶ID，同步失敗', { id: syncToastId });
    return { success: false, syncedCount: 0, failedCount: 0, remainingCount: syncQueue.length };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const remainingItems: string[] = [];

  // 使用Promise.allSettled處理並行同步操作
  const syncPromises = syncQueue.map(async (key) => {
    try {
      let success = false;
      
      // 刪除操作同步
      if (key.startsWith('mistake_delete_')) {
        const mistakeId = key.replace('mistake_delete_', '');
        success = await deleteUserMistake(mistakeId);
        
        if (success) {
          console.log(`成功同步刪除錯題: ${mistakeId}`);
          await removeFromSyncQueue(key);
          return { key, success: true };
        } else {
          console.error(`同步刪除錯題失敗: ${mistakeId}`);
          return { key, success: false };
        }
      }
      // TODO: 添加其他類型的同步處理
      
      return { key, success: false };
    } catch (error) {
      console.error(`同步項目 ${key} 失敗:`, error);
      return { key, success: false, error };
    }
  });

  // 等待所有同步操作完成
  const results = await Promise.allSettled(syncPromises);

  // 處理結果
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        syncedCount++;
      } else {
        failedCount++;
        remainingItems.push(result.value.key);
      }
    } else {
      failedCount++;
      // 找出對應的key
      const index = failedCount - 1 < syncQueue.length ? failedCount - 1 : 0;
      remainingItems.push(syncQueue[index]);
    }
  });

  // 更新同步隊列，保留失敗的項目
  if (remainingItems.length > 0) {
    await localforage.setItem(SYNC_QUEUE_KEY, remainingItems);
  } else {
    await localforage.removeItem(SYNC_QUEUE_KEY);
  }

  // 同步結果提示
  if (failedCount === 0) {
    toast.success(`同步完成：成功處理 ${syncedCount} 個項目`, { id: syncToastId });
  } else {
    toast.error(`同步部分完成：成功 ${syncedCount} 個，失敗 ${failedCount} 個`, { id: syncToastId });
  }

  return {
    success: failedCount === 0,
    syncedCount,
    failedCount,
    remainingCount: remainingItems.length
  };
}

/**
 * 設置網絡監聽器，自動嘗試同步
 * 在應用初始化時調用
 */
export function setupNetworkListener(): void {
  if (typeof window !== 'undefined') {
    // 網絡恢復時自動同步
    window.addEventListener('online', async () => {
      console.log('網絡已恢復，嘗試同步離線變更');
      toast.success('網絡已恢復連接');
      
      // 延遲一點再同步，確保網絡穩定
      setTimeout(async () => {
        if (isUserLoggedIn()) {
          await syncOfflineChanges();
        }
      }, 2000);
    });

    // 網絡斷開時提示
    window.addEventListener('offline', () => {
      console.log('網絡已斷開，將在網絡恢復後自動同步');
      toast.error('網絡已斷開，已啟用離線模式');
    });
  }
} 