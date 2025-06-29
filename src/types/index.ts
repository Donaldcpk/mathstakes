// 錯題類型定義
export interface Mistake {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  subject: string;
  educationLevel: EducationLevel;
  topicCategory?: TopicCategory;
  errorType: ErrorType;
  errorSteps?: string;
  userAnswer?: string;
  correctAnswer?: string;
  createdAt: string;
  lastReviewedAt?: string;
  reviewCount?: number;
  explanation?: string;
  tags?: string[];
  status?: string;
  updatedAt?: string;
}

// 教育階段枚舉
export enum EducationLevel {
  JUNIOR = '初中',
  SENIOR = '高中'
}

// 主題分類枚舉 (僅高中)
export enum TopicCategory {
  NUMBER_ALGEBRA = '數與代數',
  GEOMETRY_MEASURE = '幾何與測量',
  STATS_PROBABILITY = '統計與概率',
  CALCULUS = '微積分基礎'
}

// 錯誤類型枚舉
export enum ErrorType {
  CONCEPT_ERROR = '概念錯誤',
  CALCULATION_ERROR = '計算錯誤',
  CARELESS_ERROR = '粗心錯誤',
  FORMULA_ERROR = '公式錯誤',
  MISUNDERSTOOD = '題意理解錯誤',
  LOGICAL_ERROR = '邏輯錯誤',
  CALCULATOR_ERROR = '計算機操作錯誤',
  METHOD_ERROR = '方法選擇錯誤',
  UNDERSTANDING = '理解不透徹',
  STRATEGY_ERROR = '策略選擇錯誤',
  FORMATTING_ERROR = '格式錯誤',
  PROCEDURE_ERROR = '程序錯誤',
  APPLICATION_ERROR = '應用錯誤',
  MISSING_STEP = '步驟遺漏',
  SUBSTITUTION_ERROR = '代入錯誤',
  TIME_MANAGEMENT = '時間管理不當',
  UNKNOWN = '未分類'
}

// 用戶資料類型定義
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  // 用戶自定義資料
  className?: string;    // 班別
  studentId?: string;    // 學號
  mathLevel?: number;    // 數學能力自評 (0-10)
  expectation?: string;  // 對自己的期望
  createdAt: string;     // 註冊時間
  updatedAt?: string;    // 最後更新時間
  isProfileComplete: boolean; // 資料是否完整
}

// 錯題表單數據類型
export interface MistakeFormData {
  id?: string;
  title: string;
  content: string;
  imageUrl?: string;
  subject: string;
  educationLevel: EducationLevel;
  topicCategory?: TopicCategory;
  errorType?: ErrorType;
  errorSteps?: string;
  userAnswer?: string;
  correctAnswer?: string;
  explanation?: string;
  tags?: string[];
} 