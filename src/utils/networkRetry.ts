/**
 * 網絡請求自動重試工具
 * 
 * 此模組提供了處理網絡錯誤和自動重試機制的功能。
 * 使用指數退避算法增加重試間隔，避免網絡擁堵。
 */

import toast from 'react-hot-toast';

interface RetryOptions {
  /** 最大重試次數 */
  maxRetries?: number;
  /** 初始重試延遲（毫秒） */
  initialDelay?: number;
  /** 延遲乘數因子 */
  delayFactor?: number;
  /** 是否顯示重試提示 */
  showToast?: boolean;
  /** 超時時間（毫秒） */
  timeout?: number;
  /** 重試前回調函數 */
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * 使用自動重試機制包裝異步函數
 * @param fn 要執行的異步函數
 * @param options 重試配置選項
 * @returns 包裝後的異步函數
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    delayFactor = 1.5,
    showToast = true,
    timeout = 15000,
    onRetry = () => {}
  } = options;

  let attempts = 0;
  let lastError: any;

  // 建立超時控制
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`操作超時（${timeout}毫秒）`));
    }, timeout);
  });

  while (attempts <= maxRetries) {
    try {
      // 使用 Promise.race 實現超時控制
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      attempts++;
      lastError = error;

      // 已達到最大重試次數，拋出最後一個錯誤
      if (attempts > maxRetries) {
        throw error;
      }

      const delay = initialDelay * Math.pow(delayFactor, attempts - 1);
      
      // 調用重試回調函數
      onRetry(attempts, error);
      
      // 顯示重試提示
      if (showToast) {
        toast.error(`網絡請求失敗，${delay / 1000}秒後重試 (${attempts}/${maxRetries})`, {
          duration: delay,
          id: 'network-retry'
        });
      }

      // 等待延遲後重試
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // 不應該達到這裡，但為了類型安全
  throw lastError;
}

/**
 * 檢測網絡連接狀態
 * @returns 網絡是否連接
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true;
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