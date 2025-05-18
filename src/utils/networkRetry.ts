/**
 * 網絡重試工具
 * 提供網絡請求的重試機制及網絡狀態檢測
 */

/**
 * 重試配置接口
 */
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
}

/**
 * 默認重試配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000
};

/**
 * 檢查網絡是否連接
 * @returns 是否在線
 */
export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' && navigator.onLine === true;
};

/**
 * 等待指定時間
 * @param ms 等待時間（毫秒）
 * @returns Promise
 */
const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 帶重試機制的網絡請求
 * 
 * @param fn 執行的網絡請求函數
 * @param config 重試配置
 * @returns Promise<T> 請求結果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  // 合併配置
  const retryConfig: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  };
  
  let lastError: Error | null = null;
  let retryCount = 0;
  
  // 檢查網絡狀態
  if (!isOnline()) {
    throw new Error('網絡離線，無法進行操作');
  }

  // 嘗試執行，失敗時重試
  while (retryCount <= retryConfig.maxRetries) {
    try {
      // 如果不是第一次嘗試，等待指定時間
      if (retryCount > 0) {
        // 使用指數退避策略，每次重試延遲時間加倍
        const delay = retryConfig.retryDelay * Math.pow(2, retryCount - 1);
        console.log(`重試 (${retryCount}/${retryConfig.maxRetries}) 等待 ${delay}ms...`);
        await wait(delay);
      }
      
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`嘗試 ${retryCount + 1}/${retryConfig.maxRetries + 1} 失敗:`, lastError.message);
      
      // 如果是無效的API密鑰或授權問題，立即停止重試
      if (error instanceof Error && 
          (error.message.includes('無效的API金鑰') || 
           error.message.includes('401') || 
           error.message.includes('403'))) {
        console.error('授權錯誤，停止重試');
        break;
      }
      
      retryCount++;
    }
  }
  
  // 如果所有重試都失敗，拋出最後一個錯誤
  if (lastError) {
    console.error('所有重試嘗試都失敗:', lastError);
    throw lastError;
  }
  
  // 不應該到達這裏，但為了類型安全
  throw new Error('未知錯誤');
}

/**
 * 等待網絡恢復連接
 * @param checkInterval 檢查間隔（毫秒）
 * @returns 返回 Promise，當網絡恢復時解析
 */
export async function waitForNetwork(checkInterval = 3000): Promise<void> {
  // 如果已經在線，直接返回
  if (isOnline()) return;

  // 顯示離線通知
  const toastId = toast.error('您處於離線狀態，等待網絡恢復...', {
    duration: Infinity,
    id: 'offline-toast'
  });

  return new Promise(resolve => {
    // 創建事件監聽器檢測網絡變化
    const checkNetwork = () => {
      if (isOnline()) {
        toast.success('網絡已恢復連接', { id: toastId });
        window.removeEventListener('online', checkNetwork);
        clearInterval(intervalId);
        resolve();
      }
    };

    // 設置事件監聽器和輪詢間隔
    window.addEventListener('online', checkNetwork);
    const intervalId = setInterval(checkNetwork, checkInterval);
  });
} 