import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/authService";

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
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
      const data = await registerUser(formData);
      setMessage(data.message || "Dang ky thanh cong. Moi ban dang nhap.");
      setTimeout(() => navigate("/login"), 900);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container page-content">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Dang ky</h2>

        <label htmlFor="name">Ho ten</label>
        <input
          id="name"
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <label htmlFor="password">Mat khau</label>
        <input
          id="password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          minLength={6}
          required
        />

        <label htmlFor="role">Loai tai khoan</label>
        <select id="role" name="role" value={formData.role} onChange={handleChange}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>

        <button type="submit" disabled={loading}>
          {loading ? "Dang xu ly..." : "Dang ky"}
        </button>

        {message && <p className="form-message">{message}</p>}
        <p>
          Da co tai khoan? <Link to="/login">Dang nhap</Link>
        </p>
      </form>
    </main>
  );
}

export default RegisterPage;
