import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import AvatarEditor from "../components/common/AvatarEditor";
import { formatPrice, parsePrice } from "../utils/priceUtils";
import { fetchMyVouchers } from "../services/orderService";
import "../css/profile.css";
import "../css/avatar-editor.css";

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5A5.49 5.49 0 0 1 7.5 3 6.1 6.1 0 0 1 12 5.09 6.1 6.1 0 0 1 16.5 3 5.49 5.49 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.53L12 21.35Z" />
    </svg>
  );
}

function IconMenuUser() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}

function IconMenuOrders() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M7 4h10l3 6-3 10H7L4 10l3-6Zm1.62 2L6.2 9h11.6l-2.42-3H8.62ZM8 11v7h8v-7H8Z" />
    </svg>
  );
}

function IconMenuVoucher() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 1 0 4v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2a2 2 0 0 1 0-4Zm-6 6h-2v2h-2v-2H9v-2h2V9h2v2h2v2Z" />
    </svg>
  );
}

function IconMenuAddress() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z" />
    </svg>
  );
}

function IconMenuCard() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm2 2v2h14V8H5Zm0 5v5h14v-5H5Z" />
    </svg>
  );
}

function IconMenuLock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-6 7.73V17h2v-1.27a2 2 0 1 0-2 0ZM10 8V6a2 2 0 0 1 4 0v2h-4Z" />
    </svg>
  );
}

function IconMenuLogout() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M10 17v-2h4V9h-4V7l-5 5 5 5Zm1-14h8a2 2 0 0 1 2 2v4h-2V5h-8V3Zm8 14v4a2 2 0 0 1-2 2h-8v-2h8v-4h2Z" />
    </svg>
  );
}

function IconSupport() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-10 10v4a2 2 0 0 0 2 2h1v-5H4v-1a8 8 0 0 1 16 0v1h-1v5h1a2 2 0 0 0 2-2v-4A10 10 0 0 0 12 2Z" />
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
  const { auth, login, logout } = useAuth();
  const { success, error, warning } = useNotification();
  const profileEditRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: auth?.user?.name || "",
    phone: auth?.user?.phone || "",
    address: auth?.user?.address || "",
  });
  const [avatar, setAvatar] = useState(auth?.user?.avatar || "");
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("profile");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

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

  useEffect(() => {
    const loadVouchers = async () => {
      if (!auth?.token) {
        setVouchers([]);
        return;
      }
      try {
        const response = await fetchMyVouchers(auth.token);
        setVouchers(Array.isArray(response?.vouchers) ? response.vouchers : []);
      } catch (error) {
        setVouchers([]);
      }
    };
    loadVouchers();
  }, [auth?.token]);

  const metrics = useMemo(() => {
    const orderCount = orders.length;
    const points = orderCount * 50;
    return {
      orderCount,
      points,
      wishlistCount: wishlist.length,
      vouchers: vouchers.length,
    };
  }, [orders, wishlist.length, vouchers.length]);

  const recentOrders = orders.slice(0, 3);
  const wishlistPreview = wishlist.slice(0, 3);
  const memberSince = auth?.user?.createdAt
    ? new Date(auth.user.createdAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Đang cập nhật";

  const scrollToEditForm = () => {
    profileEditRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveMenu("profile");
  };

  const handleMenuAction = (key) => {
    setActiveMenu(key);

    if (key === "profile") {
      scrollToEditForm();
      return;
    }

    if (key === "orders") {
      navigate("/order-history");
      return;
    }

    if (key === "wishlist") {
      navigate("/wishlist");
      return;
    }

    if (key === "voucher") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (key === "address" || key === "payment" || key === "password") {
      scrollToEditForm();
      if (key === "password") {
        setIsPasswordModalOpen(true);
      }
      return;
    }

    if (key === "logout") {
      logout();
      navigate("/login");
    }
  };

  const sidebarItems = [
    { key: "profile", label: "Hồ sơ cá nhân", icon: <IconMenuUser /> },
    { key: "orders", label: "Đơn hàng của tôi", icon: <IconMenuOrders /> },
    { key: "wishlist", label: "Sản phẩm yêu thích", icon: <IconHeart /> },
    { key: "voucher", label: "Voucher của tôi", icon: <IconMenuVoucher /> },
    { key: "address", label: "Địa chỉ của tôi", icon: <IconMenuAddress /> },
    { key: "payment", label: "Phương thức thanh toán", icon: <IconMenuCard /> },
    { key: "password", label: "Đổi mật khẩu", icon: <IconMenuLock /> },
    { key: "logout", label: "Đăng xuất", icon: <IconMenuLogout />, danger: true },
  ];

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
      const removedItem = wishlist.find((item) => String(item?._id) === String(productId));

      const response = await fetch(`/api/auth/wishlist/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        error(data?.message || "Không thể xóa sản phẩm khỏi yêu thích.", { title: "Yêu thích" });
        return;
      }

      setWishlist(Array.isArray(data?.wishlist) ? data.wishlist : []);
      trackEvent({
        eventName: "wishlist_remove",
        token: auth?.token,
        metadata: {
          productId: String(productId),
          productName: String(removedItem?.name || ""),
          category: String(removedItem?.category || ""),
        },
      });
      success("Đã xóa sản phẩm khỏi danh sách yêu thích.", { title: "Yêu thích" });
    } catch (error) {
      error("Lỗi kết nối đến máy chủ.", { title: "Yêu thích" });
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

    if (passwordForm.newPassword.length < 6) {
      warning("Mật khẩu mới phải có ít nhất 6 ký tự.", { title: "Đổi mật khẩu" });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      warning("Xác nhận mật khẩu mới không khớp.", { title: "Đổi mật khẩu" });
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
        error(data.message || "Không thể đổi mật khẩu.", { title: "Đổi mật khẩu" });
        return;
      }

      success("Đổi mật khẩu thành công.", { title: "Tài khoản" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setIsPasswordModalOpen(false);
      }, 900);
    } catch (error) {
      error("Lỗi kết nối đến máy chủ.", { title: "Đổi mật khẩu" });
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
        setAvatar(data.user.avatar || "");
        success("Cập nhật thông tin cá nhân thành công!", { title: "Hồ sơ" });
      } else {
        error(data.message || "Không thể cập nhật thông tin cá nhân.", { title: "Hồ sơ" });
      }
    } catch (error) {
      console.error("Lỗi cập nhật:", error);
      error("Lỗi kết nối đến máy chủ.", { title: "Hồ sơ" });
    }
  };

  return (
    <main className="container page-content profile-page">
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-sidebar__brand">
            <div className="profile-sidebar__avatar">
              {avatar ? (
                <img src={avatar} alt={auth?.user?.name || "Avatar"} />
              ) : (
                <span>{String(auth?.user?.name || "A").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2>{auth?.user?.name || "Người dùng"}</h2>
              <p>{auth?.user?.email}</p>
            </div>
          </div>

          <nav className="profile-sidebar__nav" aria-label="Menu hồ sơ">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`profile-sidebar__item ${activeMenu === item.key ? "is-active" : ""} ${item.danger ? "is-danger" : ""}`}
                onClick={() => handleMenuAction(item.key)}
              >
                <span className="profile-sidebar__icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="profile-sidebar__support">
            <div className="profile-sidebar__support-title">
              <span className="profile-sidebar__support-icon"><IconSupport /></span>
              <strong>Hỗ trợ</strong>
            </div>
            <p>Nhận tư vấn về đơn hàng, đổi trả và bảo hành từ đội ngũ chăm sóc khách hàng.</p>
            <a href="mailto:support@shop.com">support@shop.com</a>
          </div>
        </aside>

        <section className="profile-main">
          <article className="profile-card profile-hero-card">
            <div className="profile-hero__avatar">
              <AvatarEditor
                currentAvatar={avatar}
                userName={auth?.user?.name}
                token={auth?.token}
                onAvatarUpdated={(user) => {
                  setAvatar(user.avatar);
                  login({ token: auth.token, user });
                }}
                showError={error}
                showSuccess={success}
                compact={true}
              />
            </div>

            <div className="profile-hero__info">
              <p className="profile-hero__eyebrow">Tổng quan tài khoản</p>
              <h1>{auth?.user?.name || "Người dùng"}</h1>

              <div className="profile-hero__details">
                <div className="profile-hero__detail">
                  <span>Email</span>
                  <strong>{auth?.user?.email || "Chưa cập nhật"}</strong>
                </div>
                <div className="profile-hero__detail">
                  <span>Số điện thoại</span>
                  <strong>{auth?.user?.phone || "Chưa cập nhật"}</strong>
                </div>
                <div className="profile-hero__detail">
                  <span>Địa chỉ</span>
                  <strong>{auth?.user?.address || "Chưa cập nhật"}</strong>
                </div>
                <div className="profile-hero__detail">
                  <span>Ngày tham gia</span>
                  <strong>{memberSince}</strong>
                </div>
              </div>

              <button type="button" className="profile-hero__action" onClick={scrollToEditForm}>
                Chỉnh sửa thông tin
              </button>
            </div>

            <div className="profile-hero__summary">
              <div className="profile-hero__summary-card">
                <span>Điểm tích lũy</span>
                <strong>{metrics.points.toLocaleString("vi-VN")}</strong>
              </div>
              <div className="profile-hero__summary-card profile-hero__summary-card--soft">
                <span>Trạng thái</span>
                <strong>Hoạt động</strong>
              </div>
            </div>
          </article>

          <section className="profile-stats-grid">
            <article className="profile-stat-card stat-blue">
              <div className="stat-icon"><IconMenuOrders /></div>
              <div className="stat-content">
                <p className="stat-label">Đơn hàng</p>
                <strong className="stat-value">{metrics.orderCount}</strong>
              </div>
            </article>

            <article className="profile-stat-card stat-pink">
              <div className="stat-icon"><IconHeart /></div>
              <div className="stat-content">
                <p className="stat-label">Yêu thích</p>
                <strong className="stat-value">{metrics.wishlistCount}</strong>
              </div>
            </article>

            <article 
              className="profile-stat-card stat-amber" 
              style={{ cursor: "pointer" }}
              onClick={() => setIsVoucherModalOpen(true)}
            >
              <div className="stat-icon"><IconMenuVoucher /></div>
              <div className="stat-content">
                <p className="stat-label">Voucher</p>
                <strong className="stat-value">{metrics.vouchers}</strong>
              </div>
            </article>

            <article className="profile-stat-card stat-violet">
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
              </div>
              <div className="stat-content">
                <p className="stat-label">Điểm tích lũy</p>
                <strong className="stat-value">{metrics.points.toLocaleString("vi-VN")}</strong>
              </div>
            </article>
          </section>

          <section className="profile-content-row">
            <article className="profile-card wishlist-card">
              <div className="card-header">
                <h3>Danh sách yêu thích</h3>
                {wishlist.length > 3 && (
                  <Link to="/wishlist" className="card-link">
                    Xem tất cả ({wishlist.length})
                  </Link>
                )}
              </div>

              <div className="wishlist-preview-grid">
                {isWishlistLoading ? (
                  <p className="empty-state">Đang tải danh sách yêu thích...</p>
                ) : wishlistPreview.length === 0 ? (
                  <p className="empty-state">Chưa có sản phẩm yêu thích.</p>
                ) : (
                  wishlistPreview.map((item) => (
                    <article key={item._id} className="wishlist-preview-card">
                      <div className="wishlist-preview-card__image">
                        <img
                          src={normalizeImageSrc(item.image)}
                          alt={item.name}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                        <button type="button" className="wishlist-preview-card__remove" onClick={() => handleRemoveWishlistItem(item._id)}>
                          <IconHeart />
                        </button>
                      </div>
                      <div className="wishlist-preview-card__body">
                        <h4>{item.name}</h4>
                        <p>{formatPrice(parsePrice(item.finalPrice || item.price || 0))}</p>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </article>

            <article className="profile-card recent-orders-card">
              <div className="card-header">
                <h3>Đơn hàng gần đây</h3>
                <button type="button" onClick={() => navigate("/order-history")} className="card-link">
                  Xem tất cả
                </button>
              </div>

              <div className="orders-list">
                {recentOrders.length === 0 ? (
                  <p className="empty-state">Chưa có đơn hàng gần đây.</p>
                ) : (
                  recentOrders.map((order) => (
                    <div key={order._id} className="order-row">
                      <div className="order-info">
                        <p className="order-id">#{String(order._id).slice(-8)}</p>
                        <p className="order-date">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</p>
                      </div>
                      <span className={`order-status status-${String(order.status || "pending").toLowerCase()}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          <article className="profile-card profile-edit-card" ref={profileEditRef}>
            <div className="card-header">
              <h3>Chỉnh sửa thông tin</h3>
              <button type="button" className="card-link" onClick={() => setIsPasswordModalOpen(true)}>
                Đổi mật khẩu
              </button>
            </div>

            <form className="profile-edit-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Họ và tên</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Nhập họ và tên"
                  />
                </div>
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Nhập số điện thoại"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Địa chỉ</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows="4"
                    placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện..."
                  />
                </div>
                <div className="form-group profile-edit__note">
                  <label>Ngày tham gia</label>
                  <div className="profile-edit__readonly">
                    {memberSince}
                  </div>
                  <p className="profile-edit__hint">
                    Avatar có thể đổi trực tiếp bằng biểu tượng camera trên ảnh đại diện.
                  </p>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </article>
        </section>
      </div>

      {isPasswordModalOpen && (
        <div className="profile-modal-backdrop">
          <div className="profile-modal-content">
            <div className="modal-header">
              <h3>Đổi mật khẩu</h3>
              <button type="button" className="modal-close" onClick={() => setIsPasswordModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="modal-form">
              <div className="form-group">
                <label>Mật khẩu hiện tại</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
              <div className="form-group">
                <label>Mật khẩu mới</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                  placeholder="Nhập mật khẩu mới"
                />
              </div>
              <div className="form-group">
                <label>Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  minLength={6}
                  placeholder="Xác nhận mật khẩu mới"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsPasswordModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Cập nhật mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isVoucherModalOpen && (
        <div className="profile-modal-backdrop">
          <div className="profile-modal-content" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h3>Ví Voucher của bạn</h3>
              <button type="button" className="modal-close" onClick={() => setIsVoucherModalOpen(false)}>
                ✕
              </button>
            </div>
            <p className="dashboard-subtitle" style={{ marginBottom: "16px", color: "var(--color-text-secondary)", fontSize: "0.9rem" }}>Danh sách các mã giảm giá bạn có thể sử dụng ngay.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto", paddingRight: "4px" }}>
              {vouchers.length === 0 ? (
                <p className="empty-state">Bạn hiện chưa có mã giảm giá nào.</p>
              ) : (
                vouchers.map(v => (
                  <div key={v.id} style={{ border: "1px dashed var(--color-primary-light)", borderRadius: "var(--radius-md)", padding: "var(--spacing-md)", background: "var(--color-primary-lighter)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ margin: "0 0 4px", color: "var(--color-primary)", fontWeight: "700" }}>{v.code}</h4>
                      <p style={{ margin: "0", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                        Giảm {v.type === "percent" ? `${v.value}%` : `${Number(v.value).toLocaleString("vi-VN")}đ`} 
                        {Number(v.minOrderValue) > 0 && ` cho đơn từ ${Number(v.minOrderValue).toLocaleString("vi-VN")}đ`}
                        {Number(v.maxDiscountValue) > 0 && ` (Tối đa ${Number(v.maxDiscountValue).toLocaleString("vi-VN")}đ)`}
                      </p>
                      {v.endDate && (
                        <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--color-accent-amber)", fontWeight: "600" }}>
                          HSD: {new Date(v.endDate).toLocaleString("vi-VN")}
                        </p>
                      )}
                    </div>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ padding: "6px 12px", fontSize: "0.85rem", borderRadius: "var(--radius-sm)" }}
                      onClick={() => {
                        navigator.clipboard.writeText(v.code);
                        success(`Đã copy mã ${v.code}`);
                      }}
                    >
                      Copy mã
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="btn-secondary"
                style={{ width: "100%" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default UserDashboard;