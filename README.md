# Mathstakes - 數學錯題學習平台

Mathstakes 是一個專為中學生設計的數學錯題管理與學習平台，幫助學生追蹤、分析和學習自己的數學錯題，從錯誤中汲取經驗並提高數學能力。

## 📅 最新更新（2023-10-01）

我們進行了一系列重大更新，以提升用戶體驗和功能：

- **優化登入流程**：移除了多餘的基本資料填寫步驟，現在使用Google帳號即可直接登入使用
- **AI模型升級**：全面更換為Meta的最新Llama 4 Maverick模型，提升識別和回答質量
- **全新錯題登記流程**：實現五步曲錯題登記流程，更加結構化和易於使用
- **CSV匯出功能**：添加直接下載錯題記錄為CSV格式的功能，方便歸檔和分享
- **錯題管理優化**：更好的錯題列表顯示和管理功能

## 🌟 五步曲錯題登記流程

我們全新設計的錯題登記流程包含五個清晰的步驟：

1. **基本資訊**：選擇教育階段（初中/高中）、年級、主題分類和題目來源
2. **題目識別**：上傳題目圖片，使用AI識別或手動輸入題目內容
3. **錯誤分析**：選擇錯誤類型，記錄錯誤步驟和答案
4. **AI解釋**：獲取智能AI分析，包含正確答案、常見錯誤和改進建議
5. **總結與保存**：下載CSV記錄，並選擇是否保存到個人錯題本

## 🔑 登入功能說明

現在使用者可以通過任何Google帳號直接登入系統，無需填寫額外的基本資料。登入後立即可以使用所有功能，體驗更加流暢。

## 📱 錯題管理功能

登入後的主頁面顯示您的錯題列表，包含以下功能：

- 按日期、類型和主題分類查看錯題
- 下載所有錯題為CSV格式文件
- 點擊任意錯題查看詳情和AI解釋
- 一鍵添加新錯題

## 💻 技術棧更新

- **AI模型**：全面採用Meta Llama 4 Maverick模型
- **前端**: React, TypeScript, TailwindCSS
- **後端/數據**: Firebase (Firestore, Authentication)
- **部署**: Vercel

## 🔧 本地開發

1. 克隆倉庫
   ```
   git clone https://github.com/your-username/mathstakes.git
   cd mathstakes
   ```

2. 安裝依賴
   ```
   npm install
   ```

3. 設置環境變數
   創建一個`.env.local`文件，添加Firebase配置信息：
   ```
   VITE_FIREBASE_API_KEY=AIzaSyBvSo54fPYT11tDeVkdC4mTgP2HqsgMb28
   VITE_FIREBASE_AUTH_DOMAIN=mathstakes-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=mathstakes-app
   VITE_FIREBASE_STORAGE_BUCKET=mathstakes-app.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=73353927746
   VITE_FIREBASE_APP_ID=1:73353927746:web:44d2814fe3c0e81b2161db
   VITE_FIREBASE_MEASUREMENT_ID=G-PFEBG1ZN30
   ```

4. 啟動開發伺服器
   ```
   npm run dev
   ```

## 📋 更新日誌

### 2023-10-01
- 移除用戶資料設置步驟，簡化登入流程
- 更換AI模型為Meta Llama 4 Maverick
- 實現五步曲錯題登記流程
- 添加CSV匯出功能
- 優化錯題管理和顯示

### 之前版本
- 實現PWA功能，支持離線使用
- 優化性能，提升載入速度
- 添加錯題統計和分類功能
- 實現基本的錯題管理功能

## 🌐 部署

應用已部署在Vercel上，可通過以下鏈接訪問：
[https://mathstakes.vercel.app](https://mathstakes.vercel.app)

## 📄 許可證

本項目使用MIT許可證 - 詳見LICENSE檔案

## 🚀 核心功能

1. **智能收集錯題**
   - 拍照上傳: 使用AI識別題目內容
   - 手動輸入: 記錄題目和錯誤內容

2. **AI診斷與解釋**
   - 使用先進AI分析錯誤原因
   - 提供詳細的解題步驟和正確方法

3. **智能複習**
   - 根據艾賓浩斯遺忘曲線安排複習提醒
   - 識別錯題模式，推薦相關練習

4. **學習進度追踪**
   - 展示錯題統計和改進趨勢
   - 可視化展示弱點領域

5. **師生協作**
   - 讓老師可查看學生錯題庫
   - 提供更有針對性的輔導

## 📱 最小可行產品 (MVP)

目前版本包含以下基本功能：

- 用戶認證（學校Google帳號登入）
- 錯題庫（新增、查看、更新和刪除錯題）
- 拍照識別錯題內容
- AI生成解釋
- 本地和雲端數據存儲
- 簡潔直觀的用戶界面

## 🔑 離線模式和本地開發

### 離線模式

Mathstakes 應用支持離線模式開發和測試：

1. **啟用離線模式**：
   在 `src/utils/ai.ts` 文件中，將 `useLocalAISimulation` 設為 `true` 可以啟用本地模擬 AI 回應功能，無需實際 API 金鑰。
   
   ```javascript
   // 使用本地模擬回應代替 API 請求
   const useLocalAISimulation = true;
   ```
   
2. **本地 AI 模擬**：
   - 啟用離線模式後，圖片識別和解題解釋將使用本地預設模板
   - 模擬回應仍然具有真實感，且無需網絡連接
   - 適合快速開發和測試、課堂演示、或無網絡環境使用

### 環境變數設置

1. 創建一個 `.env.local` 文件，添加以下內容：

   ```
   # Firebase 配置
   VITE_FIREBASE_API_KEY=AIzaSyBvSo54fPYT11tDeVkdC4mTgP2HqsgMb28
   VITE_FIREBASE_AUTH_DOMAIN=mathstakes-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=mathstakes-app
   VITE_FIREBASE_STORAGE_BUCKET=mathstakes-app.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=73353927746
   VITE_FIREBASE_APP_ID=1:73353927746:web:44d2814fe3c0e81b2161db
   VITE_FIREBASE_MEASUREMENT_ID=G-PFEBG1ZN30
   
   # OpenRouter API 金鑰 (如果需要實際 AI 功能)
   VITE_OPENROUTER_API_KEY_1=你的第一個API金鑰
   VITE_OPENROUTER_API_KEY_2=你的第二個API金鑰
   VITE_OPENROUTER_API_KEY_3=你的第三個API金鑰
   ```

2. 如果你沒有 OpenRouter API 金鑰，保持離線模式啟用即可

## 🔑 API 設置

為了充分利用 AI 功能，應用支持多 API 密鑰輪換機制：

1. 在 `.env` 文件中設置三個 OpenRouter API 密鑰：
   ```
   VITE_OPENROUTER_API_KEY_1=your-first-api-key
   VITE_OPENROUTER_API_KEY_2=your-second-api-key
   VITE_OPENROUTER_API_KEY_3=your-third-api-key
   ```

2. 系統會自動在這些密鑰之間輪換，有效：
   - 避免單一密鑰超出使用限制
   - 提高 API 請求成功率
   - 在密鑰無效時自動切換

3. 可以只設置一到兩個密鑰，但建議設置全部三個以獲得最佳體驗

## 📋 資料匯入/匯出功能

Mathstakes 提供完整的資料匯入和匯出功能，方便使用者備份和分享錯題資料：

1. **CSV 匯出**：
   - 支持將所有錯題導出為標準 CSV 格式
   - 自動處理特殊字符和格式
   - 文件命名格式為 `mistakes_export_YYYYMMDD.csv`

2. **CSV 匯入**：
   - 支持從標準 CSV 文件匯入錯題
   - 自動處理舊版格式兼容性（例如 "description" 欄位自動映射為 "explanation"）
   - 提供詳細的匯入錯誤報告

3. **欄位格式**：
   標準 CSV 文件包含以下欄位：
   - title（標題）
   - content（內容）
   - subject（學科）
   - educationLevel（教育階段）
   - errorType（錯誤類型）
   - explanation（解釋/描述）
   - createdAt（創建時間）
   - lastReviewedAt（最後復習時間）

4. **使用建議**：
   - 定期匯出錯題作為備份
   - 可以使用 Excel 或其他電子表格工具編輯 CSV 後再匯入
   - 匯入時確保保留必要的欄位名稱

## 🌐 部署

應用已部署在Vercel上，可通過以下鏈接訪問：
[https://mathstakes.vercel.app](https://mathstakes.vercel.app)

## 📄 許可證

本項目使用MIT許可證 - 詳見LICENSE檔案

## 技術棧

Mathstakes Web 應用程式使用以下技術：

- React (前端框架)
- Vite (構建工具)
- TypeScript (類型強化的 JavaScript)
- Tailwind CSS (樣式框架)
- Firebase (認證和雲端數據存儲)
- OpenAI API (AI 解釋和診斷)
- PWA 功能 (離線使用和提升用戶體驗)

## PWA 功能

Mathstakes 現已全面升級為 Progressive Web App (PWA)，提供接近原生應用的使用體驗：

- **離線使用**：即使沒有網路連接，學生也可以繼續查看和使用已保存的錯題記錄
- **安裝到主螢幕**：可以像原生應用一樣安裝在各種裝置上
- **快速載入**：利用智能緩存策略大幅減少加載時間
- **自動更新**：當有新版本發布時自動提示用戶更新
- **無網絡錯誤通知**：網絡中斷時提供友善的提示，保障用戶體驗
- **後台同步**：在網絡恢復後自動同步離線添加的錯題

### 如何安裝 Mathstakes 到您的裝置

#### 在 iOS 裝置上：
1. 在 Safari 瀏覽器中訪問 Mathstakes 網站
2. 點擊底部的分享按鈕 (方框加箭頭)
3. 滑動並選擇「加到主畫面」選項
4. 點擊「新增」確認安裝

#### 在 Android 裝置上：
1. 在 Chrome 瀏覽器中訪問 Mathstakes 網站
2. 點擊右上角的三點選單
3. 選擇「安裝應用程式」或「添加到主畫面」
4. 按照提示完成安裝

#### 在桌面電腦上：
1. 在 Chrome、Edge 或其他支援 PWA 的瀏覽器中訪問網站
2. 在地址欄右側會出現「安裝」圖示
3. 點擊該圖示並確認安裝

### 離線使用說明

1. 首次使用時，建議在有網絡連接的情況下完整瀏覽一次應用
2. 系統會自動緩存您的錯題數據和必要的頁面資源
3. 離線時可以查看已加載的錯題和添加新錯題
4. 當網絡恢復後，系統會自動同步本地變更

### 獲取更新通知

當應用有新版本時，您會收到更新提示。點擊「更新」即可獲取最新版本，享受新功能和優化的性能。

## 👤 用戶引導流程

1. **用戶註冊**：通過學校 Google 帳號登入
2. **個人資料設置**：首次登入後，填寫基本信息：
   - 班別
   - 學號
   - 數學能力自評 (0-10)
   - 學習期望
3. **空白錯題本引導**：引導新用戶了解錯題添加方式
4. **AI 輔助學習**：幫助用戶分析和理解錯題

## 安全 API 代理

為了保護應用的 API 密鑰，Mathstakes 使用後端 API 代理處理所有敏感的 API 請求：

- 所有 OpenRouter API 調用通過 `/api/openrouter-proxy` 中轉
- API 密鑰存儲在 Vercel 環境變數中，不暴露在前端代碼中
- 支持多密鑰設置和輪換機制
- 自動故障轉移和錯誤處理

### 環境變數設置

應用使用以下環境變數：

1. **後端環境變數** (不帶 VITE_ 前綴，不暴露在前端)
   - `OPENROUTER_API_KEY_1` - 主要 OpenRouter API 密鑰
   - `OPENROUTER_API_KEY_2` - 備用 OpenRouter API 密鑰 (可選)
   - `OPENROUTER_API_KEY_3` - 備用 OpenRouter API 密鑰 (可選)

2. **前端環境變數** (帶 VITE_ 前綴，暴露在前端但安全)
   - `VITE_FIREBASE_API_KEY` - Firebase API 密鑰
   - `VITE_FIREBASE_AUTH_DOMAIN` - Firebase 認證域名
   - `VITE_FIREBASE_PROJECT_ID` - Firebase 項目 ID
   - 其他 Firebase 相關環境變數

### 錯誤處理和用戶體驗

- 在 API 失敗時提供友好的錯誤信息
- 實現超時處理，避免界面凍結
- 支持在部分服務不可用時的降級處理

## API金鑰管理系統

應用程式整合了OpenRouter API，並實現了以下API金鑰管理功能：

- **多金鑰輪換**：支援多個API金鑰，當一個金鑰遇到問題時自動切換
- **錯誤處理**：自動識別並處理API請求中的各類錯誤，包括無效金鑰、請求達上限等
- **智能重試**：實現指數退避算法的重試機制，避免頻繁請求
- **金鑰效能監控**：追蹤API金鑰的使用情況和成功率

## 環境變數設定

應用程式使用以下環境變數：

```
NEXT_PUBLIC_OPENROUTER_API_KEY1=your_openrouter_api_key_1
NEXT_PUBLIC_OPENROUTER_API_KEY2=your_openrouter_api_key_2
NEXT_PUBLIC_OPENROUTER_MODEL=meta-llama/llama-4-maverick:free
```

## 系統需求

- 支援現代瀏覽器（Chrome、Firefox、Safari、Edge等）
- 支援網絡連接（離線模式僅支援基本功能）
- 支援移動設備和桌面設備

## 開發日誌

### 2023-11-07
- 完成API金鑰輪換功能
- 優化網絡請求重試邏輯
- 更新API錯誤處理機制
- 移除本地模擬功能，改用真實OpenRouter API

## 未來計劃

- [ ] 實現用戶自訂API金鑰功能
- [ ] 增強圖片識別功能
- [ ] 優化AI回應解釋格式
- [ ] 新增學習路徑推薦功能

## 平台功能

- **錯題記錄**：記錄數學錯題，包括題目內容、錯誤類型、錯誤步驟等
- **AI 輔助**：使用 AI 自動識別題目內容和提供詳細解釋
- **錯誤分析**：統計和分析常見錯誤，幫助學生了解自己的弱點
- **知識點統計**：根據錯題關聯數學知識點，看出需要加強的領域
- **離線支持**：支持離線記錄錯題，恢復網絡時自動同步
- **資料導出**：支持將錯題記錄導出為 CSV 文件

## 主要特色

1. **簡潔明了的設計**：專為中學生設計的簡潔界面，易於使用
2. **AI 輔助功能**：自動識別題目內容和提供解釋，節省輸入時間
3. **個性化分析**：根據個人錯題情況提供針對性分析和建議
4. **知識點關聯**：自動關聯數學知識點，幫助全面提升
5. **離線使用**：無需擔心網絡問題，隨時隨地可以使用

## 使用方法

### 註冊登入

1. 訪問 [Mathstakes 平台](https://mathstakes.vercel.app/)
2. 使用 Google 或 Email 註冊/登入

### 添加錯題

1. 登入後點擊「添加錯題」按鈕
2. 使用五步驟表單填寫錯題信息
   - 第一步：基本信息（標題、學科、教育階段等）
   - 第二步：題目內容（可使用 AI 圖片識別功能）
   - 第三步：錯誤分析（錯誤類型、錯誤步驟等）
   - 第四步：解題思路（正確步驟、要點說明等）
   - 第五步：知識點標籤和總結

### 設置 AI 功能

AI 功能需要使用 OpenRouter API 金鑰。請按照以下步驟設置：

1. 訪問 [OpenRouter 網站](https://openrouter.ai/keys) 註冊並獲取 API 金鑰
2. 在 Mathstakes 平台的「測試 AI」頁面或任何使用 AI 的頁面中設置您的 API 金鑰
3. 設置成功後，您可以使用圖片識別和 AI 解釋功能

### 查看和管理錯題

1. 在主頁查看所有錯題列表
2. 點擊錯題可查看詳情
3. 使用頂部過濾器按學科、知識點等進行篩選
4. 使用搜索框搜索特定錯題

### 資料導出

1. 在錯題列表頁面，點擊右上角「導出」按鈕
2. 選擇導出格式（目前支持 CSV）
3. 下載文件到本地

## 技術架構

Mathstakes 使用了以下技術：

- **前端**：React、TypeScript、Tailwind CSS
- **後端與數據庫**：Firebase (Firestore, Authentication, Storage)
- **AI 功能**：OpenRouter API (支持多種 AI 模型)
- **部署**：Vercel

## 隱私保護

我們非常重視用戶隱私：

- 所有 API 金鑰只存儲在使用者本地設備，不會發送到我們的伺服器
- 用戶數據使用 Firebase 安全規則嚴格保護
- 不會將用戶數據用於任何非服務相關的目的

## 問題反饋

如果您在使用過程中遇到任何問題，或有功能建議，請通過以下方式聯繫我們：

- 在 GitHub 上提交 Issue
- 發送電子郵件至 support@mathstakes.app

## 版本信息

- 當前版本：v1.0
- 最後更新：2025-05-20
