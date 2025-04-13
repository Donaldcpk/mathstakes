#!/bin/bash

# 安裝依賴
npm install

# 構建前端項目
npm run build

# 確保 API 目錄存在並移動到正確位置
mkdir -p .vercel/output/functions/api
cp -r api/* .vercel/output/functions/api/

# 顯示總結信息
echo "構建完成！"
echo "前端資源: $(ls -la dist | wc -l) 個文件"
echo "API 路由: $(ls -la api | wc -l) 個文件" 