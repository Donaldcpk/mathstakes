/**
 * 待同步操作類型
 */
export enum OPERATION_TYPES {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

/**
 * 待同步操作介面
 */
export interface PendingOperation {
  type: OPERATION_TYPES;
  path: string;
  data: any;
  timestamp: string;
}

const PENDING_OPERATIONS_KEY = 'pending_operations';

/**
 * 添加待同步操作
 * @param id 操作ID，通常為 `${type}_${documentId}`
 * @param operation 待同步操作對象
 */
export const addPendingOperation = async (id: string, operation: PendingOperation): Promise<void> => {
  try {
    // 從localStorage獲取現有操作
    const existingOpsStr = localStorage.getItem(PENDING_OPERATIONS_KEY);
    const pendingOps: Record<string, PendingOperation> = existingOpsStr ? JSON.parse(existingOpsStr) : {};
    
    // 添加新操作
    pendingOps[id] = operation;
    
    // 保存回localStorage
    localStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(pendingOps));
    
    console.log(`已將項目標記為待同步: ${id}`);
  } catch (error) {
    console.error('添加待同步操作失敗:', error);
    throw error;
  }
};

/**
 * 獲取所有待同步操作
 * @returns 所有待同步操作的映射
 */
export const getPendingOperations = (): Record<string, PendingOperation> => {
  try {
    const existingOpsStr = localStorage.getItem(PENDING_OPERATIONS_KEY);
    return existingOpsStr ? JSON.parse(existingOpsStr) : {};
  } catch (error) {
    console.error('獲取待同步操作失敗:', error);
    return {};
  }
};

/**
 * 刪除待同步操作
 * @param id 操作ID
 */
export const removePendingOperation = async (id: string): Promise<void> => {
  try {
    const pendingOps = getPendingOperations();
    if (pendingOps[id]) {
      delete pendingOps[id];
      localStorage.setItem(PENDING_OPERATIONS_KEY, JSON.stringify(pendingOps));
      console.log(`已移除待同步操作: ${id}`);
    }
  } catch (error) {
    console.error('刪除待同步操作失敗:', error);
    throw error;
  }
};

/**
 * 清空所有待同步操作
 */
export const clearPendingOperations = async (): Promise<void> => {
  try {
    localStorage.removeItem(PENDING_OPERATIONS_KEY);
    console.log('已清空所有待同步操作');
  } catch (error) {
    console.error('清空待同步操作失敗:', error);
    throw error;
  }
}; 