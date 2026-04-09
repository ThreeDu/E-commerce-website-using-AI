import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function UserDashboard() {
  const { auth, login } = useAuth();
  
  const [formData, setFormData] = useState({
    name: auth?.user?.name || "",
    phone: auth?.user?.phone || "",
    address: auth?.user?.address || "",
  });
  const [message, setMessage] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage("");

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setPasswordMessage(data.message || "Không thể đổi mật khẩu.");
        return;
      }

      setPasswordMessage("Đổi mật khẩu thành công.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordMessage("");
      }, 900);
    } catch (error) {
      setPasswordMessage("Lỗi kết nối đến máy chủ.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok) {
        login({ token: auth.token, user: data.user });
        setMessage("Cập nhật thông tin cá nhân thành công!");
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
      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* Cột thông tin tóm tắt */}
        <aside style={{ flex: "1 1 250px", minWidth: "250px" }}>
          <section className="hero-card" style={{ padding: "24px", borderRadius: "12px", background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)", border: "1px solid #dbeafe" }}>
            <h2 style={{ fontSize: "22px", marginBottom: "16px", marginTop: 0 }}>Hồ sơ của tôi</h2>
            <p style={{ marginBottom: "8px", color: "#1e3a8a" }}>Xin chào <strong>{auth?.user?.name}</strong></p>
            <ul style={{ listStyle: "none", padding: 0, marginTop: "16px", color: "#334155", lineHeight: "1.8" }}>
              <li><strong>Email:</strong> {auth?.user?.email}</li>
              <li><strong>Số điện thoại:</strong> {auth?.user?.phone || "Chưa cập nhật"}</li>
            </ul>
            <button
              type="button"
              onClick={() => {
                setIsPasswordModalOpen(true);
                setPasswordMessage("");
              }}
              style={{ marginTop: "14px", width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #93c5fd", backgroundColor: "#ffffff", color: "#1d4ed8", fontWeight: "bold", cursor: "pointer" }}
            >
              Đổi mật khẩu
            </button>
          </section>
        </aside>

        {/* Cột Form cập nhật hồ sơ */}
        <section style={{ flex: "1 1 600px", backgroundColor: "#fff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)" }}>
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

      {isPasswordModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
          <div style={{ width: "min(480px, 100%)", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #dbeafe", boxShadow: "0 20px 40px rgba(15, 23, 42, 0.2)", padding: "20px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "14px" }}>Đổi mật khẩu</h3>
            {passwordMessage && (
              <p style={{ marginBottom: "14px", padding: "10px", borderRadius: "6px", backgroundColor: passwordMessage.includes("thành công") ? "#dcfce7" : "#fee2e2", color: passwordMessage.includes("thành công") ? "#166534" : "#b91c1c" }}>
                {passwordMessage}
              </p>
            )}
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Mật khẩu hiện tại</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Mật khẩu mới</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: "10px 14px", borderRadius: "8px", border: "none", backgroundColor: "#1d4ed8", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
                >
                  Cập nhật mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default UserDashboard;