import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles.css'
import './css/animations.css'
import { registerSW } from 'virtual:pwa-register'

// 註冊Service Worker 並處理更新
const updateSW = registerSW({
  // 更新時執行，返回 true 表示執行更新
  onNeedRefresh() {
    if (confirm('有新版本可用，是否更新？')) {
      updateSW(true)
    }
  },
  // 離線就緒時執行
  onOfflineReady() {
    console.log('應用程式已準備好離線使用')
    // 可以在這裡添加一些UI提示
  },
  // 註冊錯誤時執行
  onRegisterError(error) {
    console.error('Service Worker 註冊失敗:', error)
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
) 