// 訊息提示功能
// 顯示不同類型的提示訊息

// 訊息類型
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * 顯示提示訊息
 * @param message 提示訊息內容
 * @param type 提示類型 (success, error, info, warning)
 * @param duration 顯示時間(毫秒), 預設 3000ms
 */
export const showToast = (
  message: string, 
  type: ToastType = 'info', 
  duration: number = 3000
): void => {
  // 移除任何現有的提示
  const existingToast = document.getElementById('app-toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
  }
  
  // 創建新的提示元素
  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.zIndex = '9999';
  toast.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  toast.style.transition = 'opacity 0.3s ease';
  toast.style.fontWeight = '500';
  toast.style.maxWidth = '90%';
  toast.style.textAlign = 'center';
  
  // 根據類型設置樣式
  switch (type) {
    case 'success':
      toast.style.backgroundColor = '#4CAF50';
      toast.style.color = 'white';
      break;
    case 'error':
      toast.style.backgroundColor = '#F44336';
      toast.style.color = 'white';
      break;
    case 'warning':
      toast.style.backgroundColor = '#FF9800';
      toast.style.color = 'white';
      break;
    case 'info':
    default:
      toast.style.backgroundColor = '#2196F3';
      toast.style.color = 'white';
      break;
  }
  
  // 設置內容
  toast.textContent = message;
  
  // 添加到頁面
  document.body.appendChild(toast);
  
  // 自動關閉
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, duration);
}; 