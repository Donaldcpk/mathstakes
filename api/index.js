// API 根路由 - 健康檢查
export default function handler(req, res) {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Mathstakes API 服務正常運行',
    time: new Date().toISOString()
  });
} 