import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// 註冊Service Worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('有新版本可用，是否更新？')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('應用已準備好離線使用')
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
) 