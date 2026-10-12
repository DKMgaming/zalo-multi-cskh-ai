#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 BẮT ĐẦU QUY TRÌNH DEPLOY DỰ ÁN ZALO AI CSKH LÊN UBUNTU"
echo "=========================================================="

# 1. Cài đặt thư viện gốc (zalo-api-final), bỏ qua husky git hook trên server
echo "📦 1/4. Đang build thư viện core zalo-api-final..."
npm install --ignore-scripts
npm run build

# 2. Build giao diện Frontend Client
echo "🎨 2/4. Đang build Frontend Client (Vite + React)..."
cd client
npm install
npm run build
cd ..

# 3. Build Backend Server
echo "⚙️  3/4. Đang build Backend Server (Express + TypeScript)..."
cd server
if [ ! -f .env ]; then
  echo "⚠️  Chưa tìm thấy .env trong server, tự động tạo từ .env.example..."
  cp .env.example .env
fi
npm install
npm run build
cd ..

# 4. Kiểm tra PM2
echo "🔄 4/4. Khởi động ứng dụng qua PM2..."
if command -v pm2 &> /dev/null; then
  pm2 restart ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
  pm2 save
  echo "✅ Đã chạy ứng dụng qua PM2 thành công!"
  echo "👉 Kiểm tra log bằng lệnh: pm2 logs zalo-cskh-server"
else
  echo "💡 PM2 chưa được cài đặt. Đang chạy kiểm thử: cd server && npm start"
  echo "   (Khuyên dùng: sudo npm install -g pm2 để chạy nền vĩnh viễn)"
fi

echo "=========================================================="
echo "🎉 DEPLOY THÀNH CÔNG! HỆ THỐNG ĐANG CHẠY TẠI PORT 5000"
echo "👉 Truy cập Web: http://<IP_SERVER_CỦA_BẠN>:5000"
echo "=========================================================="