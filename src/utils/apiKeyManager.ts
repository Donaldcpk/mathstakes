/**
 * API 密鑰管理器
 * 
 * 管理多個 API 密鑰，並自動輪換使用
 * 當遇到 429 (Too Many Requests) 或其他錯誤時自動嘗試下一個密鑰
 */

import localforage from 'localforage';

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

// 獲取所有可用的 API 密鑰
const getAllApiKeys = (): string[] => {
  return [
    import.meta.env.VITE_OPENROUTER_API_KEY_1,
    import.meta.env.VITE_OPENROUTER_API_KEY_2,
    import.meta.env.VITE_OPENROUTER_API_KEY_3
  ].filter((key): key is string => typeof key === 'string' && key.length > 0); // 過濾掉未設置的密鑰
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