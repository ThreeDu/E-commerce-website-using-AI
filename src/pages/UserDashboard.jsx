import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function UserDashboard() {
  const { auth } = useAuth();
  
  const [formData, setFormData] = useState({
    name: auth?.user?.name || "",
    phone: auth?.user?.phone || "",
    address: auth?.user?.address || "",
  });
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:5000/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}` // Gửi token lên để xác thực bảo mật
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage("Cập nhật thông tin cá nhân thành công! (Thay đổi sẽ hiển thị ở lần đăng nhập tiếp theo)");
      } else {
        setMessage(`Lỗi: ${data.message}`);
      }
    } catch (error) {
      console.error("Lỗi cập nhật:", error);
      setMessage("Lỗi kết nối đến máy chủ.");
    }
  };

  return (
    <main className="container page-content" style={{ padding: "0 20px" }}>
      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
        {/* Cột thông tin tóm tắt */}
        <aside style={{ flex: "1 1 250px", minWidth: "250px" }}>
          <section className="hero-card" style={{ padding: "24px", borderRadius: "8px", backgroundColor: "#f8f9fa", border: "1px solid #dee2e6" }}>
            <h2 style={{ fontSize: "22px", marginBottom: "16px", marginTop: 0 }}>Hồ sơ của tôi</h2>
            <p style={{ marginBottom: "8px" }}>Xin chào <strong>{auth?.user?.name}</strong></p>
            <ul style={{ listStyle: "none", padding: 0, marginTop: "16px", color: "#495057", lineHeight: "1.8" }}>
              <li><strong>Email:</strong> {auth?.user?.email}</li>
              <li><strong>Vai trò:</strong> {auth?.user?.role === "admin" ? "Quản trị viên" : "Khách hàng"}</li>
            </ul>
          </section>
        </aside>

        {/* Cột Form cập nhật hồ sơ */}
        <section style={{ flex: "1 1 600px", backgroundColor: "#fff", padding: "32px", borderRadius: "8px", border: "1px solid #dee2e6" }}>
          <h3 style={{ marginBottom: "24px", fontSize: "24px", marginTop: 0 }}>Cập nhật thông tin cá nhân</h3>
          
          {message && (
            <div style={{ padding: "12px", marginBottom: "24px", borderRadius: "4px", backgroundColor: message.includes("thành công") ? "#d4edda" : "#f8d7da", color: message.includes("thành công") ? "#155724" : "#721c24" }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Họ và tên</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required 
                style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ced4da", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Số điện thoại</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} 
                style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ced4da", boxSizing: "border-box" }} placeholder="Nhập số điện thoại..." />
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Địa chỉ giao hàng mặc định</label>
              <textarea name="address" value={formData.address} onChange={handleChange} rows="3" 
                style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ced4da", resize: "vertical", boxSizing: "border-box" }} placeholder="Nhập số nhà, tên đường, phường/xã..."></textarea>
            </div>
            <button type="submit" style={{ padding: "12px 24px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" }}>
              Lưu thay đổi
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default UserDashboard;