# 🤖 Zalo Multi-Account Manager & AI Agent CSKH (RAG Pinecone)

Hệ thống quản lý đa tài khoản Zalo cá nhân tích hợp **AI Agent Chăm sóc Khách hàng tự động (RAG)** sử dụng **Pinecone Vector Database** và mô hình **BGE Reranker v2**.

---

## 🌟 Điểm nổi bật & Tính năng chính

### 1. 👥 Quản lý Đa tài khoản Zalo (Multi-Account)
- Đăng nhập nhiều nick Zalo cùng lúc bằng cách **quét mã QR** tiện lợi.
- Tự động lưu phiên (session), tự động phục hồi kết nối sau khi khởi động lại server.
- Gửi tin nhắn 1-1, gửi tin nhắn nhóm, tra cứu danh bạ bạn bè và danh sách nhóm tham gia.
- Hỗ trợ gửi tin nhắn hàng loạt (**Broadcast**) với khoảng giãn cách chống spam an toàn.

### 2. 🧠 AI CSKH Thông minh với RAG (Retrieval-Augmented Generation)
- **Tích hợp Pinecone Vector Database**: Lưu trữ vector ngữ nghĩa đa chiều (Index `CSKH`, 1024 chiều).
- **Mô hình nhúng**: `llama-text-embed-v2` (Pinecone Hosted Inference).
- **Mô hình Tái xếp hạng (Reranker)**: `bge-reranker-v2-m3` tối ưu độ chính xác vượt trội cho tiếng Việt (kể cả khi khác biệt từ ngữ hoặc số La Mã / số thường).
- **Tự động mở rộng truy vấn (Query Expansion)**: Tự động hiểu tương đương số La Mã (`khu vực 5` ↔ `khu vực V`, `TT5`...).
- **Nạp tài liệu đa định dạng**: Hỗ trợ tải file văn bản `.docx`, `.pdf`, `.xlsx`, `.txt` lên kho tri thức và tự động phân đoạn văn bản.
- **Quản lý theo Nhóm tài liệu (Namespaces)**: Thêm, lọc và xóa sạch toàn bộ tài liệu theo nhóm trên cả Pinecone và cơ sở dữ liệu cục bộ.
- **Hỗ trợ đa nhà cung cấp LLM**: Google Gemini (`gemini-1.5-flash`), OpenAI (`gpt-4o-mini`, `gpt-3.5-turbo`) hoặc bất kỳ LLM OpenAI-compatible nào.

### 3. 🎯 Quản lý Phạm vi Trả lời AI cho từng Nick Zalo
- Cho phép cấu hình riêng cho từng nick:
  - Chỉ trả lời tin nhắn cá nhân (1-1).
  - Chỉ trả lời nhóm được chỉ định.
  - Trả lời cả cá nhân và các nhóm chọn lọc.
  - Tùy biến System Prompt riêng biệt cho từng tài khoản.

### 4. 🔒 Bảo mật Quản trị (Admin Authentication)
- Bảo vệ toàn bộ trang Dashboard và API quản trị bằng tài khoản Admin.
- Cơ chế băm mật khẩu chuẩn **Bcrypt (Salt rounds = 12)**.
- Chống dò mật khẩu (Brute-force) bằng **Rate Limiting**.
- Modal đổi mật khẩu trực tiếp ngay sau khi đăng nhập.
- Tài khoản mặc định: `admin` / `admin`.

---

## 🏗️ Cấu trúc Thư mục Dự án

```text
├── src/                  # Core thư viện zalo-api-final
├── server/               # Backend Express + SQLite + Socket.IO + Pinecone RAG
│   ├── src/
│   │   ├── routes/       # API endpoints (Auth, Accounts, Chat, AI)
│   │   ├── services/     # RAG Service, Pinecone Service, AI Agent Service, Doc Extractor
│   │   ├── database/     # SQLite Repository (Accounts, AI Settings, Knowledge Base, Admin)
│   │   └── socket/       # Socket.IO Realtime Gateway
│   └── .env.example      # Mẫu biến môi trường backend
├── client/               # Frontend React 18 + Vite + Tailwind CSS + Lucide Icons
│   ├── src/
│   │   ├── pages/        # AccountsPage, ChatPage, BroadcastPage, AiAgentPage, LoginPage
│   │   ├── components/   # Navbar, QRModal, ChangePasswordModal...
│   │   └── api/          # Axios client & Auth interceptor
├── deploy.sh             # Script deploy tự động lên Ubuntu Linux
├── ecosystem.config.cjs  # File cấu hình PM2 chạy ngầm
└── package.json
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy cục bộ (Local Development)

### Yêu cầu:
- Node.js >= 18.0.0 (Khuyên dùng v20.x hoặc v22.x)
- npm >= 9.x

### Bước 1: Clone mã nguồn
```bash
git clone <URL_REPO_CỦA_BẠN>
cd zalo-cskh
```

### Bước 2: Cài đặt và build thư viện core
```bash
npm install --ignore-scripts
npm run build
```

### Bước 3: Cài đặt Frontend
```bash
cd client
npm install
npm run build
cd ..
```

### Bước 4: Cài đặt Backend
```bash
cd server
cp .env.example .env
npm install
npm run build
npm start
```

👉 Mở trình duyệt và truy cập: **`http://localhost:5000`** (hoặc port cấu hình trong `.env`).
- **Tài khoản mặc định**: `admin`
- **Mật khẩu mặc định**: `admin`

---

## 🐧 Hướng dẫn Deploy lên Server Ubuntu với PM2

Dự án đã có sẵn script deploy tự động 1 lệnh:

```bash
chmod +x deploy.sh
./deploy.sh
```

Hoặc chạy thủ công qua PM2:
```bash
cd ~/n8n/zalo-cskh/server
pm2 start dist/app.js --name "zalo-cskh-server"
pm2 save
```

Kiểm tra log:
```bash
pm2 logs zalo-cskh-server
```

---

## 🤝 Đóng góp ý kiến (Contributing)

Mọi đóng góp, báo lỗi (Issues) và ý tưởng cải tiến (Pull Requests) đều rất được hoan nghênh! Hãy mở một Issue hoặc PR để cùng nhau phát triển hệ thống ngày một hoàn thiện hơn.

---

## 📄 License
Phát hành theo giấy phép [MIT License](LICENSE).
