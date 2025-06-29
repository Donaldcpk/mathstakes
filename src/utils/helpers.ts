/**
 * 格式化日期
 * @param dateString 日期字符串
 * @returns 格式化後的日期字符串
 */
export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) {
    return '未知日期';
  }
  
  try {
    const date = new Date(dateString);
    
    // 檢查日期是否有效
    if (isNaN(date.getTime())) {
      return '日期格式錯誤';
    }
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // 獲取星期幾
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[date.getDay()];
    
    return `${year}年${month}月${day}日 (星期${weekDay})`;
  } catch (error) {
    console.error('日期格式化錯誤:', error);
    return '日期格式錯誤';
  }
};

/**
 * 格式化時間
 * @param dateString 日期字符串或Date對象
 * @returns 格式化後的時間字符串，例如：14:30:25
 */
export const formatTime = (dateString: string | Date): string => {
  const date = new Date(dateString);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * 格式化數字，保留指定小數位
 * @param num 要格式化的數字
 * @param digits 保留的小數位數
 * @returns 格式化後的數字字符串
 */
export const formatNumber = (num: number, digits: number = 2): string => {
  return num.toFixed(digits);
};

/**
 * 截斷字符串，超出長度部分用省略號表示
 * @param str 要截斷的字符串
 * @param length 保留的最大長度
 * @returns 截斷後的字符串
 */
export const truncateString = (str: string, length: number = 50): string => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
};

/**
 * 獲取文件擴展名
 * @param filename 文件名
 * @returns 文件擴展名，如 '.jpg'
 */
export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

/**
 * 從 Base64 獲取 MIME 類型
 * @param base64String Base64 編碼的字符串
 * @returns MIME 類型，如 'image/jpeg'
 */
export const getMimeTypeFromBase64 = (base64String: string): string => {
  const matches = base64String.match(/^data:([A-Za-z-+/]+);base64,/);
  if (matches && matches.length > 1) {
    return matches[1];
  }
  return '';
};

/**
 * 隨機生成 ID
 * @param length ID 長度
 * @returns 隨機生成的 ID
 */
export const generateId = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}; 