# E-commerce Website Using AI

**Khóa luận tốt nghiệp: Xây dựng website bán hàng thông minh ứng dụng AI**

---

## Thành viên thực hiện

- Trương Hoài Khang - MSSV: 2274802010389
- Trần Anh Khoa - MSSV: 2274802010424

## Tính năng chính

### E-commerce cốt lõi

- Sản phẩm: danh sách, chi tiết, đánh giá, theo dõi lượt xem.
- Giỏ hàng và thanh toán: quản lý giỏ, đặt hàng, kiểm tra mã giảm giá.
- Đơn hàng: lịch sử, chi tiết, hủy đơn theo trạng thái cho phép.
- Tài khoản: đăng ký/đăng nhập, cập nhật hồ sơ, đổi mật khẩu, wishlist.
- Quản trị: sản phẩm, danh mục, mã giảm giá, đơn hàng, người dùng, thông báo, system logs.
- Import/Export sản phẩm: import Excel, export theo template để import lại.

### Analytics + Chatbot

- Analytics funnel: ghi nhận event (view/cart/wishlist/checkout) và tổng hợp theo ngày.
- Chatbot: gửi tin nhắn, gợi ý sản phẩm, tracking event chatbot.

### ML Service (Customer Intelligence)

- Dự đoán churn và tiềm năng khách hàng.
- API health/overview/customers/train trong ml-service.

## Công nghệ

### Frontend

- React 19, React Router DOM
- FontAwesome, Recharts
- CSS thuần

### Backend

- Node.js, Express, MongoDB (Mongoose)
- JWT + bcryptjs
- XLSX (Excel import/export)

### ML Service

- Python, Flask, Flask-CORS
- scikit-learn, pandas, numpy, joblib

## Cài đặt và chạy dự án

### Yêu cầu

- Node.js 18+
- Python 3.10+
- MongoDB (local hoặc Atlas)

### Cài đặt dependencies

```bash
npm install
```

```bash
cd ml-service
pip install -r requirements.txt
```

### Cấu hình môi trường

Tạo file .env ở thư mục gốc cho server. Các biến tối thiểu:

```
MONGO_URI=mongodb://localhost:27017/e-commerce-app
JWT_SECRET=your_secret_key
PORT=5000
```

### Chạy toàn hệ thống

```bash
.\start.bat
```

Frontend: http://localhost:3000
Backend: http://localhost:5000
ML service: cấu hình trong ml-service/config.py

## Thư mục quan trọng

- server/: Express API + MongoDB models
- src/: React app
- ml-service/: Flask API cho AI
- build/: output build

## Ghi chú

- Không đưa thư mục dataset/data vào README (đã loại trừ).
- Nếu gặp lỗi import Excel, xem template ở trang import và xuất theo template để import ngược lại.