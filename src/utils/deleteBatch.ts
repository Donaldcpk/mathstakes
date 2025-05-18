import { deleteUserMistake } from './firebase';
import localforage from 'localforage';
import { isUserLoggedIn, getUserId } from './storage';
import { toast } from 'react-hot-toast';

// 緩存參考
let cachedMistakes: any[] | null = null;
const MISTAKES_KEY = 'mistakes';

/**
 * 批次刪除錯題
 * @param mistakeIds 要刪除的錯題ID陣列
 * @returns {Promise<{success: boolean, deletedCount: number, errors: string[]}>} 刪除結果
 */
export const batchDeleteMistakes = async (
  mistakeIds: string[]
): Promise<{success: boolean, deletedCount: number, errors: string[]}> => {
  if (!mistakeIds || mistakeIds.length === 0) {
    return {success: false, deletedCount: 0, errors: ['沒有提供要刪除的錯題ID']};
  }

  const errors: string[] = [];
  let deletedCount = 0;
  let isCloudSuccess = true;

  try {
    console.log(`開始批次刪除 ${mistakeIds.length} 個錯題`);
    
    // 1. 從本地存儲獲取所有錯題
    const localMistakes = await localforage.getItem<any[]>(MISTAKES_KEY) || [];
    const filteredMistakes = localMistakes.filter(mistake => !mistakeIds.includes(mistake.id));
    
    // 2. 如果用戶已登入，嘗試從Firebase刪除
    if (isUserLoggedIn()) {
      const userId = getUserId();
      if (userId) {
        // 使用Promise.allSettled允許部分成功
        const deletePromises = mistakeIds.map(async (id) => {
          try {
            const success = await deleteUserMistake(id);
            if (!success) {
              errors.push(`雲端刪除錯題 ${id} 失敗`);
              isCloudSuccess = false;
            }
            return {id, success};
          } catch (error) {
            errors.push(`雲端刪除錯題 ${id} 時發生錯誤: ${error instanceof Error ? error.message : '未知錯誤'}`);
            isCloudSuccess = false;
            return {id, success: false};
          }
        });
        
        const results = await Promise.allSettled(deletePromises);
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            deletedCount++;
          }
        });
      }
    } else {
      // 未登入用戶只進行本地刪除
      deletedCount = mistakeIds.length;
    }
    
    // 3. 更新本地存儲
    await localforage.setItem(MISTAKES_KEY, filteredMistakes);
    
    // 4. 更新緩存
    if (cachedMistakes) {
      cachedMistakes = cachedMistakes.filter(mistake => !mistakeIds.includes(mistake.id));
    }
    
    console.log(`批次刪除完成: 成功刪除 ${deletedCount} 個錯題，失敗 ${errors.length} 個`);
    
    // 5. 提示用戶
    if (errors.length === 0) {
      toast.success(`成功刪除 ${deletedCount} 個錯題`);
      return {success: true, deletedCount, errors: []};
    } else if (deletedCount > 0) {
      // 部分成功
      toast.success(`本地成功刪除 ${deletedCount} 個錯題`);
      if (!isCloudSuccess) {
        toast.error('部分錯題無法在雲端刪除，將在下次連線時同步');
      }
      return {success: true, deletedCount, errors};
    } else {
      // 全部失敗
      toast.error('刪除錯題失敗，請重試');
      return {success: false, deletedCount: 0, errors};
    }
  } catch (error) {
    console.error('批次刪除錯題時發生錯誤:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    errors.push(`批次刪除時發生系統錯誤: ${errorMessage}`);
    toast.error('刪除失敗，請稍後重試');
    return {success: false, deletedCount, errors};
  }
};

/**
 * 清除所有本地錯題數據
 * 危險操作，僅用於重置或測試
 */
export const clearAllMistakes = async (): Promise<boolean> => {
  try {
    await localforage.removeItem(MISTAKES_KEY);
    cachedMistakes = null;
    console.log('已清除所有本地錯題數據');
    toast.success('已清除所有本地錯題');
    return true;
  } catch (error) {
    console.error('清除錯題失敗:', error);
    toast.error('清除失敗，請重試');
    return false;
  }
}; 