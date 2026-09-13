# E-commerce Website Using AI 🛍️🤖

> **Khóa luận tốt nghiệp:** Xây dựng website thương mại điện tử thông minh ứng dụng AI.

---

## 👥 Thành viên thực hiện
- **Trương Hoài Khang** - MSSV: 2274802010389
- **Trần Anh Khoa** - MSSV: 2274802010424

---

## 🚀 Tính năng nổi bật

### 1. Thương mại điện tử
- Xem danh sách, tìm kiếm, lọc phân loại danh mục sản phẩm, đánh giá và wishlist.
- Giỏ hàng, đặt hàng, thanh toán chuyển khoản ngân hàng (VietQR / BeePay) hoặc COD.
- Quản lý đơn hàng, theo dõi lịch sử mua hàng.
- Trang Admin: Quản trị sản phẩm, danh mục, đơn hàng, người dùng, mã giảm giá, log hệ thống, import/export Excel.

### 2. Trợ lý AI Chatbot (Customer & Admin)
- **Trợ lý khách hàng:**
  - Tư vấn sản phẩm, so sánh cấu hình, tìm kiếm theo danh mục.
  - Tìm kiếm ngữ nghĩa (RAG Vector Search) và tìm kiếm qua hình ảnh.
  - Phản hồi gõ chữ thời gian thực (SSE Streaming).
- **Trợ lý quản trị (Admin AI Assistant):**
  - Tra cứu doanh thu, thống kê và cập nhật trạng thái đơn hàng bằng ngôn ngữ tự nhiên.
  - Xuất báo cáo Excel, cập nhật hàng loạt sản phẩm/đơn hàng với cơ chế xác nhận an toàn.
  - Dashboard phân tích hiệu quả hoạt động chatbot (`/admin/chatbot-analytics`).
- **Cơ chế Fallback thông minh:** Tự động ưu tiên mô hình Local (LM Studio) và chuyển tiếp sang Cloud AI (Google Gemini) khi cần.

### 3. Machine Learning (Customer Intelligence)
- Dự đoán tỷ lệ rời bỏ (Churn prediction) và phân nhóm tiềm năng khách hàng.

---

## 🛠️ Công nghệ sử dụng

- **Frontend:** React 19, React Router, Tailwind CSS, FontAwesome, Recharts.
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT, Server-Sent Events (SSE).
- **AI / LLM:** Google Gemini API, LM Studio (Local LLM), text-embedding-004.
- **ML Service:** Python, Flask, scikit-learn, pandas.

---

## 💻 Hướng dẫn cài đặt & Khởi chạy

### 1. Yêu cầu hệ thống
- Node.js 18+
- Python 3.10+
- MongoDB (Local hoặc MongoDB Atlas)

### 2. Cài đặt thư viện
```bash
# Cài đặt cho Node.js (Frontend & Backend)
npm install

# Cài đặt cho ML Service
cd ml-service
pip install -r requirements.txt
cd ..
```

### 3. Cấu hình môi trường (.env)
Sao chép file `.env.example` thành `.env` và điền các thông tin cần thiết:
```bash
cp .env.example .env
```
*(Cấu hình cơ bản: `MONGO_URI`, `JWT_SECRET`, và các khóa API LLM nếu dùng chatbot)*

### 4. Khởi chạy
- **Chạy toàn bộ hệ thống (Windows):**
  ```bash
  .\start.bat
  ```
- **Hoặc chạy từng phần riêng lẻ:**
  - Backend: `npm run server` (Cổng `5000`)
  - Frontend: `npm start` (Cổng `3000`)
  - ML Service: `cd ml-service && python app.py` (Cổng `5001`)

---

## 📁 Cấu trúc thư mục chính
```text
├── server/          # Backend API (Express, Chatbot Service, Admin Chatbot)
├── src/             # Giao diện người dùng (React components & pages)
├── ml-service/      # Python Flask API phục vụ mô hình máy học
├── public/          # Tài nguyên tĩnh & file xuất báo cáo
└── .env.example     # File mẫu cấu hình biến môi trường
```
