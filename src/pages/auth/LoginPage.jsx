import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser } from "../../services/auth/authService";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faRightToBracket,
} from "@fortawesome/free-solid-svg-icons";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { success } = useNotification();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error as user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = () => {
    let isValid = true;
    const newErrors = { email: "", password: "" };

    if (!formData.email.trim()) {
      newErrors.email = "Vui lòng nhập địa chỉ email của bạn.";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Địa chỉ email không đúng định dạng (ví dụ: name@example.com).";
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = "Vui lòng nhập mật khẩu của bạn.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!validate()) return;
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
    <main className="w-full flex-1 py-14 px-4 bg-gradient-to-b from-[#f8fafc] to-[#e2e8f0]/40 flex items-center justify-center">
      <div className="w-full max-w-[480px] bg-white rounded-3xl border border-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.06)] p-8 md:p-10 flex flex-col gap-6 relative overflow-hidden transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.1)] hover:-translate-y-0.5 animate-fade-in">
        {/* Decorative Top Accent */}
        <div className="bg-gradient-to-r from-[#eb5b00] to-[#ff7824] h-1.5 w-full absolute top-0 left-0" />

        {/* Header Section */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="m-0 text-2xl font-black text-slate-800 tracking-tight">Chào mừng quay lại!</h1>
          <p className="m-0 text-sm text-slate-400 font-medium">Đăng nhập để tiếp tục mua sắm</p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {/* Email Input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
              Email
            </label>
            <div className="relative flex items-center group">
              <span className="absolute left-4 text-slate-400 group-focus-within:text-[#eb5b00] transition-colors duration-200">
                <FontAwesomeIcon icon={faEnvelope} />
              </span>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                className={`pl-11 pr-4 py-3.5 rounded-2xl border bg-slate-50/30 w-full text-[0.95rem] font-medium transition-all outline-none focus:bg-white focus:ring-4 ${
                  errors.email
                    ? "border-red-400 focus:border-red-500 focus:ring-red-500/5"
                    : "border-slate-200 focus:border-[#eb5b00] focus:ring-[#eb5b00]/5"
                }`}
              />
            </div>
            {errors.email && (
              <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                {errors.email}
              </span>
            )}
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center px-1">
              <label htmlFor="password" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Mật khẩu
              </label>
            </div>
            <div className="relative flex items-center group">
              <span className="absolute left-4 text-slate-400 group-focus-within:text-[#eb5b00] transition-colors duration-200">
                <FontAwesomeIcon icon={faLock} />
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`pl-11 pr-11 py-3.5 rounded-2xl border bg-slate-50/30 w-full text-[0.95rem] font-medium transition-all outline-none focus:bg-white focus:ring-4 ${
                  errors.password
                    ? "border-red-400 focus:border-red-500 focus:ring-red-500/5"
                    : "border-slate-200 focus:border-[#eb5b00] focus:ring-[#eb5b00]/5"
                }`}
              />
              <button
                type="button"
                className="absolute right-4 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none p-0 flex items-center justify-center text-md"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </div>
            {errors.password && (
              <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                {errors.password}
              </span>
            )}
          </div>

          {/* Error Message */}
          {message && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-red-600 text-sm font-semibold text-center animate-fade-in">
              {message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#eb5b00] to-[#ff7824] text-white font-bold text-sm tracking-wider shadow-[0_8px_20px_rgba(235,91,0,0.2)] hover:shadow-[0_8px_24px_rgba(235,91,0,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              "Đang xử lý..."
            ) : (
              <>
                Đăng nhập
                <FontAwesomeIcon icon={faRightToBracket} />
              </>
            )}
          </button>
        </form>



        {/* Footer */}
        <div className="text-center mt-2">
          <p className="m-0 text-sm text-slate-400 font-medium">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="text-[#eb5b00] font-bold no-underline hover:underline transition-all">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
