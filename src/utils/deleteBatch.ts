import { db } from './firebase';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { addPendingOperation, OPERATION_TYPES } from './pendingOperations';
import { getCurrentUserAuthStatus } from './auth';
import { toast } from 'react-hot-toast';
import { getMistakes, deleteMistake } from './storage';

/**
 * 批量刪除錯題
 * @param mistakeIds 要刪除的錯題ID數組
 * @returns 操作結果
 */
export const batchDeleteMistakes = async (mistakeIds: string[]): Promise<{success: boolean, failed: string[], succeeded: string[]}> => {
  if (!mistakeIds.length) {
    return {success: false, failed: [], succeeded: []};
  }
  
  const { isOnline, isLoggedIn, currentUser } = await getCurrentUserAuthStatus();
  const failed: string[] = [];
  const succeeded: string[] = [];
  
  // 如果在線且已登錄，嘗試直接刪除
  if (isOnline && isLoggedIn && currentUser) {
    console.log(`開始批次刪除 ${mistakeIds.length} 個錯題`);
    
    for (const id of mistakeIds) {
      try {
        // 嘗試從Firestore直接刪除
        const mistakeRef = doc(db, 'mistakes', id);
        await deleteDoc(mistakeRef);
        
        // 同時從本地刪除
        await deleteMistake(id);
        succeeded.push(id);
        
        console.log(`成功刪除錯題 ${id}`);
      } catch (error) {
        console.error(`刪除錯題失敗 ${id}:`, error);
        
        // 如果Firebase刪除失敗，標記為待同步刪除
        const operationId = `mistake_delete_${id}`;
        await addPendingOperation(operationId, {
          type: OPERATION_TYPES.DELETE,
          path: `mistakes/${id}`,
          data: null,
          timestamp: new Date().toISOString()
        });
        
        console.log(`已將錯題 ${id} 標記為待同步刪除`);
        
        // 仍然嘗試從本地刪除
        try {
          await deleteMistake(id);
          succeeded.push(id);
        } catch (localError) {
          console.error(`本地刪除錯題失敗 ${id}:`, localError);
          failed.push(id);
        }
      }
    }
  } else {
    // 離線模式：僅添加到待同步操作，並從本地刪除
    console.log(`離線模式下批次刪除 ${mistakeIds.length} 個錯題`);
    
    for (const id of mistakeIds) {
      try {
        // 標記為待同步刪除
        const operationId = `mistake_delete_${id}`;
        await addPendingOperation(operationId, {
          type: OPERATION_TYPES.DELETE,
          path: `mistakes/${id}`,
          data: null,
          timestamp: new Date().toISOString()
        });
        
        // 從本地刪除
        await deleteMistake(id);
        succeeded.push(id);
        
        console.log(`已將錯題 ${id} 標記為待同步刪除`);
      } catch (error) {
        console.error(`離線模式下刪除錯題失敗 ${id}:`, error);
        failed.push(id);
      }
    }
  }
  
  console.log(`批次刪除完成: 成功刪除 ${succeeded.length} 個錯題，失敗 ${failed.length} 個`);
  
  if (failed.length > 0) {
    toast.error(`${failed.length} 個錯題刪除失敗，將在網絡連接時自動重試`);
  }
  
  return {
    success: succeeded.length > 0,
    failed,
    succeeded
  };
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