import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../../services/auth/authService";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { success } = useNotification();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const data = await loginUser(formData);
      login({ token: data.token, user: data.user });
      success("Bạn đã đăng nhập thành công.", { title: "Xác thực" });

      if (data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <form className="max-w-[460px] mx-auto p-6 bg-white rounded-xl shadow-card grid gap-2.5" onSubmit={handleSubmit}>
        <h2>Đăng nhập</h2>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="p-2.5 rounded-lg border border-[#c7d3e0] text-[0.95rem]"
        />

        <label htmlFor="password">Mật khẩu</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
          className="p-2.5 rounded-lg border border-[#c7d3e0] text-[0.95rem]"
        />

        <button type="submit" disabled={loading} className="p-2.5 rounded-lg border-none bg-auth-primary text-white font-semibold text-[0.95rem] cursor-pointer hover:brightness-110 transition-all disabled:opacity-60">
          {loading ? "Đang xử lý..." : "Đăng nhập"}
        </button>

        {message && <p className="my-2 text-[#0f8b8d]">{message}</p>}
        <p>
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </form>
    </main>
  );
}

export default LoginPage;
