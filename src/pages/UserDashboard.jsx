import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../css/profile.css";

function IconOrders() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v14h14V5H5Zm3 2h8v2H8V7Zm0 4h8v2H8v-2Zm0 4h5v2H8v-2Z" />
    </svg>
  );
}

function IconVoucher() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-4Zm-6 6h-2v2h-2v-2H9v-2h2V9h2v2h2v2Z" />
    </svg>
  );
}

function normalizeImageSrc(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "/placeholder.svg";
  }

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:image/") ||
    raw.startsWith("/")
  ) {
    return raw;
  }

  return `/${raw.replace(/^\/+/, "")}`;
}

function UserDashboard() {
  const navigate = useNavigate();
  const { auth, login } = useAuth();
  const editFormRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: auth?.user?.name || "",
    phone: auth?.user?.phone || "",
    address: auth?.user?.address || "",
  });
  const [message, setMessage] = useState("");
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    const loadMyOrders = async () => {
      if (!auth?.token) {
        return;
      }

      try {
        const response = await fetch("/api/orders/my-orders", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        setOrders([]);
      }
    };

    loadMyOrders();
  }, [auth?.token]);

  useEffect(() => {
    const loadWishlist = async () => {
      if (!auth?.token) {
        setWishlist([]);
        return;
      }

      setIsWishlistLoading(true);
      try {
        const response = await fetch("/api/auth/wishlist", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        if (!response.ok) {
          setWishlist([]);
          return;
        }

        const data = await response.json();
        setWishlist(Array.isArray(data?.wishlist) ? data.wishlist : []);
      } catch (error) {
        setWishlist([]);
      } finally {
        setIsWishlistLoading(false);
      }
    };

    loadWishlist();
  }, [auth?.token]);

  const metrics = useMemo(() => {
    const orderCount = orders.length;
    const points = orderCount * 50;
    return {
      orderCount,
      points,
      vouchers: 5,
    };
  }, [orders]);

  const recentOrders = orders.slice(0, 3);

  const getStatusLabel = (statusValue) => {
    const status = String(statusValue || "pending").toLowerCase();
    if (status === "delivered") {
      return "Đã giao";
    }
    if (status === "shipping") {
      return "Đang giao";
    }
    if (status === "confirmed") {
      return "Đã xác nhận";
    }
    if (status === "cancelled") {
      return "Đã hủy";
    }
    return "Chờ xử lý";
  };

  const handleRemoveWishlistItem = async (productId) => {
    if (!auth?.token || !productId) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/wishlist/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data?.message || "Không thể xóa sản phẩm khỏi yêu thích.");
        return;
      }

      setWishlist(Array.isArray(data?.wishlist) ? data.wishlist : []);
      setMessage("Đã xóa sản phẩm khỏi danh sách yêu thích.");
    } catch (error) {
      setMessage("Lỗi kết nối đến máy chủ.");
    }
  };

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
    <main className="container page-content profile-page profile-bento-page">
      <section className="profile-topbar">
        <div>
          <h2>Hồ sơ cá nhân</h2>
        </div>
      </section>

      <section className="profile-bento-grid">
        <article className="bento-card profile-hero-card">
          <div className="hero-avatar-stack" aria-hidden="true">
            <span className="hero-shape shape-orange" />
            <span className="hero-shape shape-navy" />
            <span className="hero-avatar-core">{String(auth?.user?.name || "A").slice(0, 1).toUpperCase()}</span>
          </div>
          <div>
            <p className="hero-eyebrow">Chào mừng quay lại</p>
            <h3>{auth?.user?.name || "Người dùng"}</h3>
            <p className="hero-email">{auth?.user?.email}</p>
            <span className="member-badge">Thành viên Vàng</span>
          </div>
        </article>

        <article className="bento-card metric-card tone-blue">
          <div className="metric-icon"><IconOrders /></div>
          <p>Lịch sử đơn hàng</p>
          <strong>{metrics.orderCount} đơn</strong>
        </article>

        <article className="bento-card metric-card tone-orange">
          <div className="metric-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2 4 7v6c0 5 3.4 8.74 8 9.93 4.6-1.19 8-4.93 8-9.93V7l-8-5Zm0 2.18 6 3.75V13c0 3.94-2.53 7.17-6 8.32-3.47-1.15-6-4.38-6-8.32V7.93l6-3.75ZM11 8h2v6h-2V8Zm0 8h2v2h-2v-2Z" /></svg>
          </div>
          <p>Điểm tích lũy</p>
          <strong>{metrics.points.toLocaleString("vi-VN")} điểm</strong>
        </article>

        <article className="bento-card metric-card tone-green">
          <div className="metric-icon"><IconVoucher /></div>
          <p>Ví voucher</p>
          <strong>{metrics.vouchers} voucher</strong>
        </article>

        <article className="bento-card content-card recent-orders-card">
          <div className="card-heading">
            <h4>Đơn hàng gần đây</h4>
            <button type="button" onClick={() => navigate("/order-history")}>Xem tất cả</button>
          </div>
          <div className="recent-orders-list">
            {recentOrders.length === 0 ? (
              <p className="empty-text">Chưa có đơn hàng gần đây.</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order._id} className="recent-order-item">
                  <div className="recent-order-thumb" />
                  <div>
                    <p className="recent-order-id">#{String(order._id).slice(-8)}</p>
                    <p className="recent-order-date">{new Date(order.createdAt).toLocaleString("vi-VN")}</p>
                  </div>
                  <span className="timeline-status">{getStatusLabel(order.status)}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="bento-card content-card wishlist-card">
          <div className="card-heading">
            <h4>Danh sách yêu thích</h4>
          </div>
          <div className="wishlist-grid">
            {isWishlistLoading ? (
              <p className="empty-text">Đang tải danh sách yêu thích...</p>
            ) : wishlist.length === 0 ? (
              <p className="empty-text">Bạn chưa có sản phẩm yêu thích.</p>
            ) : (
              wishlist.map((item) => (
                <figure key={item._id} className="wishlist-item">
                  <img src={normalizeImageSrc(item.image)} alt={item.name} onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.svg";
                  }} />
                  <figcaption>{item.name}</figcaption>
                  <button
                    type="button"
                    className="wishlist-remove-btn"
                    onClick={() => handleRemoveWishlistItem(item._id)}
                  >
                    Xóa
                  </button>
                </figure>
              ))
            )}
          </div>
        </article>

        <article className="bento-card content-card payment-card">
          <div className="card-heading">
            <h4>Phương thức thanh toán</h4>
          </div>
          <div className="payment-list">
            <div className="payment-chip visa">VISA •••• 2048</div>
            <div className="payment-chip master">MASTER •••• 8812</div>
            <div className="payment-chip momo">Ví MoMo</div>
          </div>
        </article>

        <article className="bento-card content-card profile-edit-card" ref={editFormRef}>
          <div className="card-heading">
            <h4>Chỉnh sửa hồ sơ</h4>
            <button type="button" onClick={() => setIsPasswordModalOpen(true)}>Đổi mật khẩu</button>
          </div>

          {message && (
            <div className={`profile-alert ${message.includes("thành công") ? "success" : "error"}`}>
              {message}
            </div>
          )}

          <form className="profile-edit-form" onSubmit={handleSubmit}>
            <label>
              <span>Họ và tên</span>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required />
            </label>
            <label>
              <span>Số điện thoại</span>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Nhập số điện thoại..." />
            </label>
            <label>
              <span>Địa chỉ giao hàng</span>
              <textarea name="address" value={formData.address} onChange={handleChange} rows="3" placeholder="Nhập số nhà, tên đường, phường/xã..." />
            </label>
            <button type="submit" className="primary-action">Lưu thay đổi</button>
          </form>
        </article>
      </section>

      {isPasswordModalOpen && (
        <div className="profile-modal-backdrop">
          <div className="profile-modal-card">
            <h3>Đổi mật khẩu</h3>
            {passwordMessage && (
              <p className={`profile-alert ${passwordMessage.includes("thành công") ? "success" : "error"}`}>
                {passwordMessage}
              </p>
            )}
            <form onSubmit={handleChangePassword}>
              <div className="password-field">
                <label>Mật khẩu hiện tại</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                />
              </div>
              <div className="password-field">
                <label>Mật khẩu mới</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                />
              </div>
              <div className="password-field">
                <label>Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="secondary-action"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="primary-action"
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