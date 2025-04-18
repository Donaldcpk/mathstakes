# Mathstakes - 數學錯題學習平台

Mathstakes是一個幫助中學生從數學錯題中學習的Web應用程式。透過記錄、分析和複習錯題，學生可以更有效地發現並糾正自己的知識盲點。

## 🚀 最新更新：效能大幅提升

我們剛完成了一系列重大效能優化，解決了載入緩慢和儲存失敗的問題：

- **資料緩存機制**：所有錯題數據實現緩存，大幅減少載入時間
- **離線優先策略**：確保即使網絡不穩定也能正常使用
- **批量數據載入**：使用分頁加載方式，避免一次性載入大量數據
- **AI響應緩存**：重複的圖片識別和解釋請求使用緩存，節約API調用
- **重試機制**：自動重試失敗的請求，提高儲存成功率
- **超時控制**：更合理的超時設置，避免無限等待

## 🌟 核心功能

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

## 💻 技術堆棧

- **前端**: React, TypeScript, TailwindCSS
- **後端/數據**: Firebase (Firestore, Authentication)
- **人工智能**: OpenRouter API (GPT-4o, Claude-3)
- **部署**: Vercel

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
   創建一個`.env.local`文件，添加以下內容：
   ```
   VITE_FIREBASE_API_KEY=your-firebase-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-firebase-auth-domain
   VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-firebase-storage-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-firebase-messaging-sender-id
   VITE_FIREBASE_APP_ID=your-firebase-app-id
   VITE_OPENROUTER_API_KEY=your-openrouter-api-key
   ```

4. 啟動開發伺服器
   ```
   npm run dev
   ```

## 📋 未來規劃

- 實現完整錯題複習計劃
- 添加錯題分類和標籤系統
- 增強資料分析和學習報告
- 實現老師查看學生錯題功能
- 優化離線支持
- 開發移動應用版本

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
