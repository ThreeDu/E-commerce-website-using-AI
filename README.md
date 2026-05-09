# E-commerce Website Using AI 🚀

**Khóa luận tốt nghiệp: Xây dựng website bán hàng thông minh ứng dụng AI**

Đây là một dự án thương mại điện tử toàn diện (Fullstack), kết hợp các tính năng mua sắm truyền thống với các mô hình Trí tuệ Nhân tạo (Machine Learning) để dự đoán hành vi người dùng, cá nhân hóa trải nghiệm và hỗ trợ quản trị hệ thống.

---

## 👥 Thành viên thực hiện
* **Trương Hoài Khang** - MSSV: 2274802010389
* **Trần Anh Khoa** - MSSV: 2274802010424

---

## 🌟 Các tính năng nổi bật (Features)

### 1. Hệ thống E-commerce Cốt lõi
* **Quản lý Sản phẩm**: Liệt kê, tìm kiếm, phân trang và xem chi tiết sản phẩm. Import hàng loạt bằng Excel.
* **Giỏ hàng & Thanh toán**: Quản lý giỏ hàng, áp dụng **mã giảm giá thông minh** (tự động tính toán điều kiện dựa trên tổng tiền).
* **Quản lý Đơn hàng & Hồ sơ**: Dashboard người dùng quản lý thông tin cá nhân, theo dõi trạng thái đơn, ví voucher, sản phẩm yêu thích (wishlist), và hệ thống điểm tích lũy.
* **Phân quyền người dùng**: Hệ thống Auth an toàn với JWT, chia quyền rõ ràng giữa Khách hàng và Quản trị viên (Admin).

### 2. Ứng dụng Trí tuệ Nhân tạo (AI Features)
* **Dự đoán khách hàng rời bỏ (Churn Prediction)**: Sử dụng mô hình Machine Learning phân tích lịch sử mua hàng, tần suất truy cập để phát hiện khách hàng có nguy cơ rời bỏ hệ thống, từ đó tung ra các chiến lược khuyến mãi (Voucher) giữ chân kịp thời.
* **Đánh giá khách hàng tiềm năng (Potential Customer Classification)**: Đánh giá và xếp hạng độ tiềm năng của người dùng (Thấp, Trung bình, Cao) dựa trên hành vi chi tiêu.
* **Customer Intelligence Dashboard**: Bảng điều khiển riêng dành cho Admin để theo dõi các chỉ số phân tích và dự đoán AI.

---

## 🛠️ Công nghệ & Thư viện sử dụng (Tech Stack)

Hệ thống được chia làm 3 thành phần chính: **Frontend**, **Backend**, và **Machine Learning Service**.

### 1. Frontend (Giao diện người dùng)
* **React.js (v19)**: Thư viện cốt lõi để xây dựng UI Component.
* **React Router DOM**: Quản lý điều hướng (Routing) mượt mà không cần tải lại trang.
* **FortAwesome (FontAwesome)**: Sử dụng hệ thống icon vector chuyên nghiệp.
* **Recharts**: Vẽ biểu đồ thống kê trực quan trên Admin Dashboard.
* **CSS thuần**: Toàn bộ UI được thiết kế riêng với CSS Variables, CSS Grid/Flexbox để đảm bảo tính độc bản và hiệu suất.

### 2. Backend (Máy chủ & Cơ sở dữ liệu)
* **Node.js & Express.js**: Nền tảng xây dựng API xử lý nghiệp vụ, quản lý đơn hàng, giỏ hàng, phân quyền.
* **MongoDB & Mongoose**: Cơ sở dữ liệu NoSQL lưu trữ thông tin sản phẩm, đơn hàng, và người dùng linh hoạt.
* **Mã hóa & Bảo mật**: Sử dụng `bcryptjs` để băm mật khẩu và `jsonwebtoken` (JWT) để xác thực người dùng.
* **XLSX**: Đọc và ghi dữ liệu file Excel cho tính năng Bulk Import/Export.

### 3. ML Service (Dịch vụ Trí tuệ nhân tạo)
* **Python**: Ngôn ngữ chính để phát triển và chạy các model dự đoán.
* **Flask & Flask-CORS**: Xây dựng API (Microservice) giao tiếp với Node.js Backend.
* **Scikit-learn (sklearn)**: Xây dựng và huấn luyện các mô hình phân loại (Random Forest/Logistic Regression...).
* **Pandas & NumPy**: Xử lý, làm sạch và chuẩn hóa dữ liệu lớn trước khi đưa vào model.
* **Joblib**: Lưu trữ và tải (load) các mô hình ML đã được train sẵn.

---

## 🚀 Hướng dẫn Cài đặt & Chạy dự án (How to run)

### Yêu cầu hệ thống:
- [Node.js](https://nodejs.org/) (phiên bản 18+).
- [Python](https://www.python.org/) (phiên bản 3.10+).
- MongoDB (Local hoặc MongoDB Atlas).

### Bước 1: Cài đặt thư viện Node.js (Frontend & Backend)
Mở terminal tại thư mục gốc của dự án (`E-commerce-website-using-AI`), chạy lệnh:
```bash
npm install
```

### Bước 2: Cài đặt môi trường Python (ML Service)
Di chuyển vào thư mục dịch vụ AI và cài đặt các thư viện cần thiết:
```bash
cd ml-service
pip install -r requirements.txt
```

### Bước 3: Cấu hình biến môi trường
Tạo các file `.env` (dựa trên các cấu hình cần thiết) để kết nối Database MongoDB và chuỗi secret của JWT. (Xem các file `.env.example` nếu có).

### Bước 4: Khởi chạy dự án
Chỉ cần chạy file thực thi đã được lập trình sẵn ở thư mục gốc:
```bash
.\start.bat
```
File này sẽ tự động:
1. Chạy Backend (Node.js) và Frontend (React) qua lệnh `npm start`.
2. Khởi động Microservice AI bằng `python app.py`.

Trang web sẽ được mở tại: `http://localhost:3000` (hoặc cổng cấu hình tương tự).