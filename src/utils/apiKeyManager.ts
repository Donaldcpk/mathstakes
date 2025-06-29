/**
 * API 密鑰管理器
 * 
 * 管理多個 API 密鑰，並自動輪換使用
 * 當遇到 429 (Too Many Requests) 或其他錯誤時自動嘗試下一個密鑰
 */

import localforage from 'localforage';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { toast } from 'react-hot-toast';

// 密鑰使用統計資料儲存
const API_KEY_STATS_KEY = 'openrouter_api_key_stats';

// 初始化儲存 API 密鑰使用統計的 localforage 實例
const apiKeyStats = localforage.createInstance({
  name: 'mathstakes',
  storeName: 'api_key_stats'
});

// 密鑰使用統計接口
interface ApiKeyStats {
  keyIndex: number;        // 當前使用的密鑰索引
  usageCounts: number[];   // 各密鑰使用次數
  errorCounts: number[];   // 各密鑰錯誤次數
  lastRotated: number;     // 上次輪換時間戳
  cooldowns: number[];     // 各密鑰冷卻截止時間戳
}

// 存儲上次使用的 API 密鑰索引
let lastKeyIndex = -1;

// 存儲上次 API 失效標記
const invalidKeys: Record<string, boolean> = {};

// API金鑰配置
interface ApiConfig {
  apiKey: string;
  model: string;
  isValid: boolean;
}

// 本地存儲中的金鑰名稱
const API_KEY_STORAGE_KEY = 'mathstakes_api_keys';
const API_KEY_ACTIVE_INDEX = 'mathstakes_active_api_key_index';

// 環境變數中的默認 API 金鑰
const DEFAULT_API_KEY = 
  import.meta.env.VITE_OPENROUTER_API_KEY || 
  import.meta.env.VITE_OPENROUTER_API_KEY_1 || 
  import.meta.env.OPENROUTER_API_KEY;

// 環境變數中的默認模型
const DEFAULT_MODEL = 
  import.meta.env.VITE_OPENROUTER_MODEL || 
  'mistralai/mistral-small-3.2-24b-instruct:free';

// 當前使用的金鑰索引
let currentKeyIndex = 0;

// 追蹤無效的API金鑰
const invalidApiKeys: Set<string> = new Set();

/**
 * 重置所有 API 密鑰的有效性
 */
export const resetKeysValidity = (): void => {
  Object.keys(invalidKeys).forEach(key => {
    invalidKeys[key] = false;
  });
};

/**
 * 從環境變數獲取所有可用的 API 密鑰
 * @returns API 密鑰數組
 */
export const getAllApiKeys = (): string[] => {
  // 先嘗試從環境變數獲取密鑰
  const envKeys = [
    import.meta.env.VITE_OPENROUTER_API_KEY_1,
    import.meta.env.VITE_OPENROUTER_API_KEY_2,
    import.meta.env.VITE_OPENROUTER_API_KEY_3
  ].filter(Boolean); // 過濾掉未定義的密鑰
  
  // 如果有環境變數密鑰，返回它們
  if (envKeys.length > 0) {
    return envKeys;
  }
  
  // 如果沒有環境變數密鑰，使用備用密鑰
  // 注意：這些密鑰僅用於演示，實際使用時需要替換為真實的 API 密鑰
  return [DEFAULT_API_KEY];
};

/**
 * 獲取下一個可用的 API 密鑰
 * @returns API 配置對象
 */
export const getNextApiKey = (): { useProxy: boolean; apiKey: string } => {
  const apiKeys = getAllApiKeys();
  
  // 如果沒有可用的 API 密鑰，則返回默認配置
  if (apiKeys.length === 0) {
    console.warn('沒有找到 API 密鑰，請設置環境變數');
    return {
      useProxy: true,
      apiKey: 'demo'
    };
  }
  
  // 嘗試找到一個可用的 API 密鑰
  for (let i = 0; i < apiKeys.length; i++) {
    // 計算下一個索引，實現循環選擇
    lastKeyIndex = (lastKeyIndex + 1) % apiKeys.length;
    const apiKey = apiKeys[lastKeyIndex];
    
    // 如果這個密鑰未被標記為失效，則使用它
    if (!invalidKeys[apiKey]) {
      console.log(`使用 API 密鑰 #${lastKeyIndex + 1}`);
      return {
        useProxy: false,
        apiKey
      };
    }
  }
  
  // 如果所有密鑰都被標記為失效，重置所有標記並使用第一個密鑰
  console.warn('所有 API 密鑰都被標記為失效，重置狀態並重試第一個密鑰');
  resetKeysValidity();
  lastKeyIndex = 0;
  
  return {
    useProxy: false,
    apiKey: apiKeys[0]
  };
};

/**
 * 標記當前 API 密鑰為失效
 * @param apiKey 要標記為失效的 API 密鑰
 */
export const markApiKeyAsInvalid = (apiKey: string): void => {
  console.warn(`標記 API 密鑰為失效: ${apiKey.substring(0, 8)}...`);
  invalidKeys[apiKey] = true;
  
  // 檢查是否所有密鑰都被標記為失效
  const allKeys = getAllApiKeys();
  const allInvalid = allKeys.every(key => invalidKeys[key]);
  
  if (allInvalid) {
    console.error('所有 API 密鑰都被標記為失效，自動重置');
    resetKeysValidity();
  }
};

/**
 * 獲取備用 API 配置（當所有 API 密鑰都失效時使用）
 * @returns 備用 API 配置
 */
export const getFallbackApiConfig = () => {
  return {
    useProxy: true,
    apiKey: 'demo'
  };
};

// 導出的 API 配置獲取函數，供其他模塊使用
export const getApiConfig = (): ApiConfig => {
  // 獲取所有 API 金鑰
  let apiKeys = loadApiKeys();
  
  // 確保有默認金鑰
  if (apiKeys.length === 0 && DEFAULT_API_KEY) {
    apiKeys = [{ apiKey: DEFAULT_API_KEY, model: DEFAULT_MODEL, isValid: true }];
    saveApiKeys(apiKeys);
  }
  
  // 如果沒有可用的金鑰，返回空配置
  if (apiKeys.length === 0) {
    console.warn('沒有可用的 API 金鑰配置');
    return { apiKey: '', model: DEFAULT_MODEL, isValid: false };
  }
  
  // 獲取活動金鑰索引
  let activeIndex = getActiveKeyIndex();
  
  // 確保索引有效
  if (activeIndex >= apiKeys.length) {
    activeIndex = 0;
    setActiveKeyIndex(activeIndex);
  }
  
  // 嘗試找到有效的金鑰
  let validKeyFound = false;
  let startIndex = activeIndex;
  
  do {
    if (apiKeys[activeIndex].isValid) {
      validKeyFound = true;
      break;
    }
    
    // 移到下一個金鑰
    activeIndex = (activeIndex + 1) % apiKeys.length;
  } while (activeIndex !== startIndex);
  
  // 如果沒有找到有效的金鑰，重置所有金鑰為有效
  if (!validKeyFound) {
    console.warn('沒有找到有效的 API 金鑰，重置所有金鑰');
    apiKeys = apiKeys.map(key => ({ ...key, isValid: true }));
    saveApiKeys(apiKeys);
  }
  
  // 儲存當前活動索引
  setActiveKeyIndex(activeIndex);
  
  const result = apiKeys[activeIndex];
  console.log(`使用 API 金鑰 [${activeIndex + 1}/${apiKeys.length}]: ${result.apiKey.substring(0, 5)}...`);
  
  return result;
};

// 從本地存儲加載 API 金鑰
const loadApiKeys = (): ApiConfig[] => {
  try {
    const storedKeys = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!storedKeys) {
      // 如果沒有存儲的金鑰，使用環境變數中的默認金鑰
      if (DEFAULT_API_KEY) {
        return [{ apiKey: DEFAULT_API_KEY, model: DEFAULT_MODEL, isValid: true }];
      }
      return [];
    }
    return JSON.parse(storedKeys);
  } catch (error) {
    console.error('加載 API 金鑰時出錯:', error);
    // 發生錯誤時，如果有默認金鑰，則使用它
    if (DEFAULT_API_KEY) {
      return [{ apiKey: DEFAULT_API_KEY, model: DEFAULT_MODEL, isValid: true }];
    }
    return [];
  }
};

// 保存 API 金鑰到本地存儲
const saveApiKeys = (apiKeys: ApiConfig[]): void => {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(apiKeys));
  } catch (error) {
    console.error('保存 API 金鑰時出錯:', error);
    toast.error('無法保存 API 金鑰設置');
  }
};

// 獲取當前活動的 API 金鑰索引
const getActiveKeyIndex = (): number => {
  try {
    const index = localStorage.getItem(API_KEY_ACTIVE_INDEX);
    return index ? parseInt(index, 10) : 0;
  } catch (error) {
    console.error('獲取活動金鑰索引時出錯:', error);
    return 0;
  }
};

// 設置當前活動的 API 金鑰索引
const setActiveKeyIndex = (index: number): void => {
  try {
    localStorage.setItem(API_KEY_ACTIVE_INDEX, index.toString());
  } catch (error) {
    console.error('設置活動金鑰索引時出錯:', error);
  }
};

// 獲取當前使用的 API 密鑰
export const getCurrentApiKey = async (): Promise<string> => {
  const stats = await getApiKeyStats();
  const apiKeys = getAllApiKeys();
  
  if (apiKeys.length === 0) {
    throw new Error('未設置任何 API 密鑰，請在環境變數中配置至少一個密鑰');
  }
  
  // 檢查當前密鑰是否處於冷卻期
  const now = Date.now();
  if (stats.cooldowns[stats.keyIndex] > now) {
    // 當前密鑰在冷卻期，尋找可用的密鑰
    const availableKeyIndex = stats.cooldowns.findIndex(cooldown => cooldown <= now);
    if (availableKeyIndex >= 0) {
      stats.keyIndex = availableKeyIndex;
      await updateApiKeyStats(stats);
      console.log(`API 密鑰切換至 #${availableKeyIndex + 1} (由於冷卻期)`);
    } else {
      // 所有密鑰都在冷卻期，使用冷卻期最短的那個
      const minCooldownIndex = stats.cooldowns.reduce(
        (minIndex, cooldown, index) => cooldown < stats.cooldowns[minIndex] ? index : minIndex,
        0
      );
      stats.keyIndex = minCooldownIndex;
      await updateApiKeyStats(stats);
      console.log(`所有 API 密鑰都在冷卻期，使用冷卻期最短的 #${minCooldownIndex + 1}`);
    }
  }
  
  // 更新使用統計
  stats.usageCounts[stats.keyIndex]++;
  await updateApiKeyStats(stats);
  
  return apiKeys[stats.keyIndex];
};

// 切換到下一個 API 密鑰
export const rotateToNextApiKey = async (errorStatus?: number): Promise<string> => {
  const stats = await getApiKeyStats();
  const apiKeys = getAllApiKeys();
  
  if (apiKeys.length <= 1) {
    console.warn('只有一個 API 密鑰可用，無法輪換');
    return apiKeys[0];
  }
  
  // 更新當前密鑰的錯誤計數
  stats.errorCounts[stats.keyIndex]++;
  
  // 如果是速率限制錯誤 (429)，為當前密鑰設置冷卻期
  if (errorStatus === 429) {
    // 設置 5 分鐘冷卻期
    stats.cooldowns[stats.keyIndex] = Date.now() + 5 * 60 * 1000;
    console.warn(`API 密鑰 #${stats.keyIndex + 1} 達到速率限制，進入冷卻期 5 分鐘`);
  }
  
  // 切換到下一個密鑰
  const prevIndex = stats.keyIndex;
  stats.keyIndex = (stats.keyIndex + 1) % apiKeys.length;
  stats.lastRotated = Date.now();
  
  // 檢查下一個密鑰是否處於冷卻期
  const now = Date.now();
  if (stats.cooldowns[stats.keyIndex] > now) {
    // 尋找不在冷卻期的密鑰
    let foundAvailable = false;
    const startIndex = stats.keyIndex;
    
    do {
      stats.keyIndex = (stats.keyIndex + 1) % apiKeys.length;
      if (stats.cooldowns[stats.keyIndex] <= now) {
        foundAvailable = true;
        break;
      }
    } while (stats.keyIndex !== startIndex);
    
    if (!foundAvailable) {
      // 所有密鑰都在冷卻期，使用冷卻期最短的那個
      const minCooldownIndex = stats.cooldowns.reduce(
        (minIndex, cooldown, index) => cooldown < stats.cooldowns[minIndex] ? index : minIndex,
        0
      );
      stats.keyIndex = minCooldownIndex;
      console.warn('所有 API 密鑰都在冷卻期，使用冷卻期最短的一個');
    }
  }
  
  await updateApiKeyStats(stats);
  console.log(`API 密鑰從 #${prevIndex + 1} 切換至 #${stats.keyIndex + 1}`);
  
  return apiKeys[stats.keyIndex];
};

// 標記當前 API 密鑰請求成功
export const markApiKeySuccess = async (): Promise<void> => {
  // 可以在這裡添加額外的成功統計邏輯
};

// 重置所有 API 密鑰統計
export const resetApiKeyStats = async (): Promise<void> => {
  const apiKeys = getAllApiKeys();
  const newStats: ApiKeyStats = {
    keyIndex: 0,
    usageCounts: Array(apiKeys.length).fill(0),
    errorCounts: Array(apiKeys.length).fill(0),
    lastRotated: Date.now(),
    cooldowns: Array(apiKeys.length).fill(0)
  };
  
  await updateApiKeyStats(newStats);
  console.log('API 密鑰統計已重置');
};

// 初始化或獲取 API 密鑰使用統計
const getApiKeyStats = async (): Promise<ApiKeyStats> => {
  try {
    const stats = await apiKeyStats.getItem<ApiKeyStats>(API_KEY_STATS_KEY);
    if (stats) return stats;
    
    // 初始化統計資料
    const apiKeys = getAllApiKeys();
    const newStats: ApiKeyStats = {
      keyIndex: 0,
      usageCounts: Array(apiKeys.length).fill(0),
      errorCounts: Array(apiKeys.length).fill(0),
      lastRotated: Date.now(),
      cooldowns: Array(apiKeys.length).fill(0)
    };
    
    await apiKeyStats.setItem(API_KEY_STATS_KEY, newStats);
    return newStats;
  } catch (error) {
    console.error('獲取 API 密鑰統計失敗:', error);
    // 返回默認值
    return {
      keyIndex: 0,
      usageCounts: [0, 0, 0],
      errorCounts: [0, 0, 0],
      lastRotated: Date.now(),
      cooldowns: [0, 0, 0]
    };
  }
};

// 更新 API 密鑰使用統計
const updateApiKeyStats = async (stats: ApiKeyStats): Promise<void> => {
  try {
    await apiKeyStats.setItem(API_KEY_STATS_KEY, stats);
  } catch (error) {
    console.error('更新 API 密鑰統計失敗:', error);
  }
};

// 添加新的 API 金鑰
export const addApiKey = (apiKey: string, model: string = DEFAULT_MODEL): void => {
  if (!apiKey.trim()) {
    toast.error('API 金鑰不能為空');
    return;
  }
  
  const apiKeys = loadApiKeys();
  
  // 檢查是否已存在
  if (apiKeys.some(key => key.apiKey === apiKey)) {
    toast.error('此 API 金鑰已存在');
    return;
  }
  
  // 添加新金鑰
  apiKeys.push({ apiKey, model, isValid: true });
  saveApiKeys(apiKeys);
  
  // 設置為活動金鑰
  setActiveKeyIndex(apiKeys.length - 1);
  
  toast.success('新的 API 金鑰已添加並設置為活動');
}; 