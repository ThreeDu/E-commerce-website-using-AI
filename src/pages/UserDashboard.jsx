import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import AvatarEditor from "../components/common/AvatarEditor";
import { formatPrice, parsePrice } from "../utils/priceUtils";
import { fetchMyVouchers } from "../services/orderService";
import { getMyPoints, getRewards, redeemPoints } from "../services/pointService";


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

function IconGift() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h16v6z" />
    </svg>
  );
}

function IconMenuStats() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
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
  const location = useLocation();
  const { auth, login, logout } = useAuth();
  const { success, error } = useNotification();
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
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [pointHistory, setPointHistory] = useState([]);
  const [rewardTiers, setRewardTiers] = useState([]);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [activeMenu, setActiveMenu] = useState("profile");
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [weeklyStatsLoading, setWeeklyStatsLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileErrors, setProfileErrors] = useState({ name: "" });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("openVoucher") === "true") {
      setIsVoucherModalOpen(true);
      navigate("/profile", { replace: true });
    }
  }, [location.search, navigate]);

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

  useEffect(() => {
    const loadPoints = async () => {
      if (!auth?.token) {
        setLoyaltyPoints(0);
        setPointHistory([]);
        return;
      }
      try {
        const data = await getMyPoints(auth.token);
        setLoyaltyPoints(Number(data?.points || 0));
        setPointHistory(Array.isArray(data?.history) ? data.history : []);
      } catch (err) {
        setLoyaltyPoints(0);
      }
    };
    loadPoints();
  }, [auth?.token]);

  useEffect(() => {
    const loadRewards = async () => {
      try {
        const data = await getRewards(auth?.token);
        setRewardTiers(Array.isArray(data?.rewards) ? data.rewards : []);
      } catch (err) {
        setRewardTiers([]);
      }
    };
    loadRewards();
  }, [auth?.token]);

  const handleRedeem = async (tierId) => {
    if (isRedeeming) return;
    setIsRedeeming(true);
    try {
      const data = await redeemPoints(tierId, auth?.token);
      success(data?.message || "Đổi điểm thành công!", { title: "Đổi thưởng" });
      setLoyaltyPoints(Number(data?.remainingPoints || 0));

      // Reload vouchers & points history
      const [ptsData, vData] = await Promise.all([
        getMyPoints(auth.token),
        fetchMyVouchers(auth.token),
      ]);
      setPointHistory(Array.isArray(ptsData?.history) ? ptsData.history : []);
      setVouchers(Array.isArray(vData?.vouchers) ? vData.vouchers : []);
    } catch (err) {
      error(err?.message || "Không thể đổi điểm.", { title: "Đổi thưởng" });
    } finally {
      setIsRedeeming(false);
    }
  };

  const metrics = useMemo(() => {
    const orderCount = orders.length;
    return {
      orderCount,
      points: loyaltyPoints,
      wishlistCount: wishlist.length,
      vouchers: vouchers.length,
    };
  }, [orders, wishlist.length, vouchers.length, loyaltyPoints]);

  const recentOrders = orders.slice(0, 3);
  const wishlistPreview = wishlist.slice(0, 3);
  const memberSince = auth?.user?.createdAt
    ? new Date(auth.user.createdAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Đang cập nhật";

  const loadWeeklyStats = useCallback(async () => {
    if (!auth?.token) return;
    try {
      setWeeklyStatsLoading(true);
      const response = await fetch("/api/analytics/my-weekly-stats", {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setWeeklyStats(data);
      }
    } catch (err) {
      console.error("Error loading weekly stats:", err);
    } finally {
      setWeeklyStatsLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    if (activeMenu === "stats") {
      loadWeeklyStats();
    }
  }, [activeMenu, loadWeeklyStats]);

  const scrollToEditForm = () => {
    profileEditRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveMenu("profile");
  };

  const handleMenuAction = (key) => {
    if (key === "voucher") {
      setIsVoucherModalOpen(true);
      return;
    }

    if (key === "redeem") {
      setIsRedeemModalOpen(true);
      return;
    }

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
    { key: "stats", label: "Báo cáo tuần & Chi tiêu", icon: <IconMenuStats /> },
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
    if (profileErrors[name]) {
      setProfileErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (passwordErrors[name]) {
      setPasswordErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    let isValid = true;
    const newErrors = { currentPassword: "", newPassword: "", confirmPassword: "" };

    if (!passwordForm.currentPassword) {
      newErrors.currentPassword = "Vui lòng nhập mật khẩu hiện tại.";
      isValid = false;
    }

    if (!passwordForm.newPassword) {
      newErrors.newPassword = "Vui lòng nhập mật khẩu mới.";
      isValid = false;
    } else if (passwordForm.newPassword.length < 6) {
      newErrors.newPassword = "Mật khẩu mới phải có ít nhất 6 ký tự.";
      isValid = false;
    }

    if (!passwordForm.confirmPassword) {
      newErrors.confirmPassword = "Vui lòng xác nhận mật khẩu mới.";
      isValid = false;
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
      isValid = false;
    }

    if (!isValid) {
      setPasswordErrors(newErrors);
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
      setPasswordErrors({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setIsPasswordModalOpen(false);
      }, 900);
    } catch (error) {
      error("Lỗi kết nối đến máy chủ.", { title: "Đổi mật khẩu" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setProfileErrors({ name: "Vui lòng nhập họ và tên của bạn." });
      return;
    }
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
    <main className="w-[min(1200px,95%)] mx-auto flex-1 py-10 px-4">
      <div className="grid grid-cols-[260px_1fr] gap-6 max-[960px]:grid-cols-1">
        <aside className="sticky top-6 h-fit bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#e2e8f0] flex flex-col gap-4">
          <div className="flex items-center gap-4 py-3 border-b border-[#f3f4f6] mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ddd6fe] to-[#bfdbfe] flex items-center justify-center shrink-0 overflow-hidden border-2 border-[#e5e7eb]">
              {avatar ? (
                <img src={avatar} alt={auth?.user?.name || "Avatar"} className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-xl font-bold text-profile-primary">{String(auth?.user?.name || "A").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#1f2937] m-0 leading-tight truncate">{auth?.user?.name || "Người dùng"}</h2>
              <p className="text-xs text-[#9ca3af] m-0 leading-tight break-all truncate mt-0.5">{auth?.user?.email}</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5" aria-label="Menu hồ sơ">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`flex items-center gap-3.5 py-3.5 px-4 bg-transparent border-none rounded-xl cursor-pointer text-sm font-medium transition-all text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b] text-left ${
                  item.danger
                    ? "text-[#ef4444] hover:bg-[#ef4444]/10"
                    : ""
                } ${
                  activeMenu === item.key
                    ? item.danger
                      ? "bg-[#ef4444]/15 text-[#ef4444] font-semibold"
                      : "bg-[#f5f3ff] text-[#4f46e5] font-semibold"
                    : ""
                }`}
                onClick={() => handleMenuAction(item.key)}
              >
                <span className="w-5 h-5 flex items-center justify-center text-inherit">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4.5 bg-gradient-to-br from-[#eff6ff] to-[#f4f7ff] border border-[#dbeafe] rounded-2xl mt-2 flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 text-[#2563eb] flex items-center justify-center"><IconSupport /></span>
              <strong className="text-xs font-bold text-[#1e2937] uppercase tracking-wider">Hỗ trợ</strong>
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed m-0">Nhận tư vấn về đơn hàng, đổi trả và bảo hành từ đội ngũ chăm sóc khách hàng.</p>
            <a href="mailto:support@shop.com" className="text-xs text-[#2563eb] no-underline font-bold hover:underline">support@shop.com</a>
          </div>
        </aside>

        <section className="grid gap-6">
          {activeMenu === "stats" ? (
            <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col gap-6 text-left">
              <div>
                <span className="text-[11px] font-bold text-[#6366f1] uppercase tracking-wider block mb-1">Thống kê hoạt động</span>
                <h2 className="text-2xl font-black text-[#1e293b] m-0 mb-1 leading-tight">Hoạt động tuần này</h2>
                <p className="text-xs text-[#94a3b8] m-0 leading-normal mt-0.5">Theo dõi lịch sử truy cập và chi tiêu cá nhân trong tuần</p>
              </div>

              {weeklyStatsLoading ? (
                <div className="py-20 text-center text-slate-500 font-medium space-y-2">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm">Đang tải báo cáo của bạn...</p>
                </div>
              ) : weeklyStats ? (
                <div className="space-y-6">
                  {/* Stats metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#eff6ff] to-[#dbeafe]/40 border border-[#dbeafe]/80 shadow-sm flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-[#2563eb] uppercase tracking-wide">Truy cập tuần này</span>
                      <strong className="text-slate-800 text-2xl font-black">{weeklyStats.weeklyVisits} lượt</strong>
                    </div>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#fef2f2] to-[#fee2e2]/40 border border-[#fee2e2]/80 shadow-sm flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-[#ef4444] uppercase tracking-wide">Chi tiêu trọn đời</span>
                      <strong className="text-red-600 text-2xl font-black">{formatPrice(parsePrice(weeklyStats.totalSpent))}</strong>
                    </div>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7]/40 border border-[#dcfce7]/80 shadow-sm flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-[#16a34a] uppercase tracking-wide">Đơn hàng đã đặt</span>
                      <strong className="text-slate-800 text-2xl font-black">{weeklyStats.totalOrders} đơn</strong>
                    </div>
                  </div>

                  {/* Spending chart by day (Monday to Sunday) */}
                  <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
                    <div className="font-bold text-slate-800 text-sm">Biểu đồ chi tiêu tuần này</div>
                    <div className="h-[200px] flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-200">
                      {weeklyStats.weeklySpendsByDay?.map((amount, idx) => {
                        const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
                        const maxSpend = Math.max(...weeklyStats.weeklySpendsByDay, 1);
                        const heightPercent = (amount / maxSpend) * 100;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                            {/* Amount Tooltip on hover */}
                            {amount > 0 && (
                              <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md z-10">
                                {formatPrice(parsePrice(amount))}
                              </div>
                            )}
                            {/* Bar */}
                            <div 
                              className={`w-full rounded-t-lg transition-all duration-500 cursor-pointer ${
                                amount > 0 ? "bg-gradient-to-t from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.25)] hover:from-indigo-600 hover:to-violet-600" : "bg-slate-100"
                              }`}
                              style={{ height: `${Math.max(4, heightPercent)}%` }}
                            />
                            {/* Label */}
                            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                              {dayNames[idx]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Weekly Notification Summary */}
                  <div className="border border-slate-200/80 rounded-2xl p-4 bg-[#f8fbff] border-indigo-100 flex gap-3.5 items-start">
                    <span className="text-xl text-indigo-600 shrink-0">📊</span>
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Báo cáo hoạt động tuần</div>
                      <p className="text-xs text-[#4f6078] leading-relaxed m-0">
                        {weeklyStats.weeklyVisits > 0 || weeklyStats.weeklySpendsByDay?.reduce((a,b)=>a+b, 0) > 0 ? (
                          `Tuần này bạn đã ghé thăm shop ${weeklyStats.weeklyVisits} lần và tích cực mua sắm. Tổng số đơn hàng trọn đời đã đặt đạt ${weeklyStats.totalOrders} đơn với mức chi tiêu ${formatPrice(parsePrice(weeklyStats.totalSpent))}.`
                        ) : (
                          "Tuần này bạn chưa có hoạt động truy cập hay mua sắm nào. Hãy tham khảo các sản phẩm mới nhất của chúng tôi!"
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-400 py-10">Không tìm thấy dữ liệu báo cáo tuần này.</p>
              )}
            </article>
          ) : (
            <>
              <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_200px] gap-6 items-start border-b border-[#f1f5f9] pb-6 mb-6">
                  <div className="flex justify-center shrink-0">
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

                  <div className="flex flex-col text-left">
                    <span className="text-[11px] font-bold text-[#6366f1] uppercase tracking-wider block mb-1">TỔNG QUAN TÀI KHOẢN</span>
                    <h1 className="text-2xl font-black text-[#1e293b] m-0 mb-5 leading-tight">{auth?.user?.name || "Người dùng"}</h1>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-[480px]:grid-cols-1 text-left">
                      <div>
                        <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">EMAIL</span>
                        <span className="text-sm font-semibold text-[#1e293b] block break-all leading-normal">{auth?.user?.email || "Chưa cập nhật"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">SỐ ĐIỆN THOẠI</span>
                        <span className="text-sm font-semibold text-[#1e293b] block leading-normal">{auth?.user?.phone || "Chưa cập nhật"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">ĐỊA CHỈ</span>
                        <span className="text-sm font-semibold text-[#1e293b] block leading-snug">{auth?.user?.address || "Chưa cập nhật"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">NGÀY THAM GIA</span>
                        <span className="text-sm font-semibold text-[#1e293b] block leading-normal">{memberSince || "Đang cập nhật"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 self-center">
                    <div className="bg-[#f8fafc] border border-[#f1f5f9] p-3.5 rounded-2xl flex flex-col hover:bg-[#f1f5f9] transition-all" style={{ cursor: "pointer" }} onClick={() => setIsRedeemModalOpen(true)}>
                      <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">ĐIỂM TÍCH LŨY</span>
                      <span className="text-2xl font-black text-[#1e293b] mt-0.5">{metrics.points.toLocaleString("vi-VN")}</span>
                    </div>
                    <div className="bg-[#eff6ff] border border-[#dbeafe] p-3.5 rounded-2xl flex flex-col">
                      <span className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-wider">TRẠNG THÁI</span>
                      <span className="text-sm font-black text-[#2563eb] mt-1">Hoạt động</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_200px] gap-6">
                  <div className="hidden md:block"></div>
                  <div className="text-left">
                    <button type="button" className="py-2.5 px-8 bg-[#3b82f6] text-white border-none rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer transition-all hover:bg-blue-600 hover:-translate-y-0.5 shadow-sm hover:shadow-[0_4px_12px_rgba(59,130,246,0.35)]" onClick={scrollToEditForm}>
                      Chỉnh sửa thông tin
                    </button>
                  </div>
                  <div className="hidden md:block"></div>
                </div>
              </article>

              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <article className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#eff6ff] text-[#3b82f6]"><IconMenuOrders /></div>
                  <div className="flex flex-col min-w-0">
                    <p className="m-0 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">ĐƠN HÀNG</p>
                    <strong className="m-0 text-xl font-black text-[#1e293b] mt-0.5">{metrics.orderCount}</strong>
                  </div>
                </article>

                <article className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.01)]">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#fff1f2] text-[#f43f5e]"><IconHeart /></div>
                  <div className="flex flex-col min-w-0">
                    <p className="m-0 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">YÊU THÍCH</p>
                    <strong className="m-0 text-xl font-black text-[#1e293b] mt-0.5">{metrics.wishlistCount}</strong>
                  </div>
                </article>

                <article 
                  className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.01)] cursor-pointer hover:bg-[#fafafa] transition-all" 
                  onClick={() => setIsVoucherModalOpen(true)}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#fef3c7] text-[#d97706]"><IconMenuVoucher /></div>
                  <div className="flex flex-col min-w-0">
                    <p className="m-0 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">VOUCHER</p>
                    <strong className="m-0 text-xl font-black text-[#1e293b] mt-0.5">{metrics.vouchers}</strong>
                  </div>
                </article>

                <article 
                  className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.01)] cursor-pointer hover:bg-[#fafafa] transition-all" 
                  onClick={() => setIsRedeemModalOpen(true)}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#f5f3ff] text-[#8b5cf6]"><IconGift /></div>
                  <div className="flex flex-col min-w-0">
                    <p className="m-0 text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">ĐIỂM TÍCH LŨY</p>
                    <strong className="m-0 text-xl font-black text-[#1e293b] mt-0.5">{metrics.points.toLocaleString("vi-VN")}</strong>
                  </div>
                </article>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col">
                  <div className="flex justify-between items-center pb-3 border-b border-[#f1f5f9] mb-4">
                    <h3 className="m-0 text-sm font-bold text-[#1f2937]">Danh sách yêu thích</h3>
                    {wishlist.length > 3 && (
                      <Link to="/wishlist" className="text-xs font-semibold text-[#6366f1] no-underline hover:underline">
                        Xem tất cả ({wishlist.length})
                      </Link>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {isWishlistLoading ? (
                      <p className="text-center py-6 text-[#6b7280] text-sm col-span-3">Đang tải danh sách yêu thích...</p>
                    ) : wishlistPreview.length === 0 ? (
                      <p className="text-center py-6 text-[#6b7280] text-sm col-span-3">Chưa có sản phẩm yêu thích.</p>
                    ) : (
                      wishlistPreview.map((item) => (
                        <article key={item._id} className="flex flex-col gap-2 relative bg-white border border-[#f1f5f9] rounded-2xl overflow-hidden p-2.5 group hover:border-[#cbd5e1] hover:shadow-sm transition-all text-center">
                          <div className="w-full aspect-square rounded-xl bg-[#f8fafc] relative overflow-hidden flex items-center justify-center">
                            <img
                              src={normalizeImageSrc(item.image)}
                              alt={item.name}
                              className="w-full h-full object-cover rounded-xl transition-transform group-hover:scale-105"
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = "/placeholder.svg";
                              }}
                            />
                            <button 
                              type="button" 
                              className="absolute top-2 right-2 w-6.5 h-6.5 rounded-full bg-white flex items-center justify-center border border-[#e5e7eb] cursor-pointer text-[#ef4444] shadow-sm hover:scale-110 transition-transform" 
                              onClick={() => handleRemoveWishlistItem(item._id)}
                              aria-label="Xóa khỏi yêu thích"
                            >
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5A5.49 5.49 0 0 1 7.5 3 6.1 6.1 0 0 1 12 5.09 6.1 6.1 0 0 1 16.5 3 5.49 5.49 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.53L12 21.35Z" /></svg>
                            </button>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <h4 className="text-[11px] font-semibold text-[#1e293b] line-clamp-2 h-8 m-0 leading-snug">{item.name}</h4>
                            <p className="text-[13px] font-bold text-[#2563eb] mt-1">{formatPrice(parsePrice(item.finalPrice || item.price || 0))}</p>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </article>

                <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col">
                  <div className="flex justify-between items-center pb-3 border-b border-[#f1f5f9] mb-4">
                    <h3 className="m-0 text-sm font-bold text-[#1f2937]">Đơn hàng gần đây</h3>
                    <button type="button" onClick={() => navigate("/order-history")} className="text-xs font-semibold text-[#6366f1] border-none bg-transparent cursor-pointer no-underline hover:underline">
                      Xem tất cả
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {recentOrders.length === 0 ? (
                      <p className="text-center py-6 text-[#6b7280] text-sm">Chưa có đơn hàng gần đây.</p>
                    ) : (
                      recentOrders.map((order) => (
                        <div key={order._id} className="flex justify-between items-center p-3 border border-[#f1f5f9] rounded-2xl hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-all" style={{ cursor: "pointer" }} onClick={() => navigate(`/order-history/${order._id}`)}>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-sm text-[#1e293b]">#{String(order._id).slice(-8)}</span>
                            <span className="text-[11px] text-[#94a3b8]">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</span>
                          </div>
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                            order.status === "delivered" ? "bg-[#f0fdf4] text-[#16a34a] border-[#dcfce7]" :
                            order.status === "shipping" ? "bg-[#ecfdf5] text-[#059669] border-[#d1fae5]" :
                            order.status === "confirmed" ? "bg-[#eff6ff] text-[#2563eb] border-[#dbeafe]" :
                            order.status === "cancelled" ? "bg-[#fef2f2] text-[#dc2626] border-[#fee2e2]" :
                            "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]" // pending
                          }`}>
                            {getStatusLabel(order.status).toUpperCase()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </section>

              <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col" ref={profileEditRef}>
                <div className="flex justify-between items-center p-6 border-b border-[#f3f4f6]">
                  <h3 className="m-0 text-lg font-bold text-[#1f2937]">Chỉnh sửa thông tin</h3>
                  <button type="button" className="text-xs font-semibold text-profile-primary no-underline hover:underline" onClick={() => setIsPasswordModalOpen(true)}>
                    Đổi mật khẩu
                  </button>
                </div>

                <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
                  <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Họ và tên</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Nhập họ và tên"
                        className={`w-full p-3.5 rounded-xl border bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all ${
                          profileErrors.name ? "border-red-400 focus:ring-red-450" : "border-[#cbd5e1]"
                        }`}
                      />
                      {profileErrors.name && (
                        <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                          {profileErrors.name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Số điện thoại</label>
                      <input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Nhập số điện thoại"
                        className="w-full p-3.5 rounded-xl border border-[#cbd5e1] bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Địa chỉ</label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        rows="4"
                        placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện..."
                        className="w-full p-3.5 rounded-xl border border-[#cbd5e1] bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-2 content-start">
                      <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Ngày tham gia</label>
                      <div className="min-h-12 flex items-center px-3.5 py-3 rounded-[14px] bg-gradient-to-br from-[#f8fafc] to-[#eef2ff] border border-[#e5e7eb] text-[#0f172a] font-bold">
                        {memberSince}
                      </div>
                      <p className="m-0 text-[#64748b] text-[0.88rem] leading-relaxed">
                        Avatar có thể đổi trực tiếp bằng biểu tượng camera trên ảnh đại diện.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3.5 mt-4">
                    <button type="submit" className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-profile-primary text-white hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
                      Lưu thay đổi
                    </button>
                  </div>
                </form>
              </article>
            </>
          )}
        </section>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9999] p-5">
          <div className="bg-white rounded-2xl w-full max-w-[500px] p-6 shadow-xl border border-[#e2e8f0] animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-[#f1f5f9]">
              <h3 className="m-0 text-xl font-extrabold text-[#0f172a]">Đổi mật khẩu</h3>
              <button type="button" className="w-8 h-8 rounded bg-[#f1f5f9] border-none text-[#64748b] text-[1.2rem] cursor-pointer transition-all flex items-center justify-center hover:bg-[#e2e8f0] hover:text-[#0f172a]" onClick={() => setIsPasswordModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="Nhập mật khẩu hiện tại"
                  className={`w-full p-3.5 rounded-xl border bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all ${
                    passwordErrors.currentPassword ? "border-red-400 focus:ring-red-400/50" : "border-[#cbd5e1]"
                  }`}
                />
                {passwordErrors.currentPassword && (
                  <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                    {passwordErrors.currentPassword}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Mật khẩu mới</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Nhập mật khẩu mới"
                  className={`w-full p-3.5 rounded-xl border bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all ${
                    passwordErrors.newPassword ? "border-red-400 focus:ring-red-400/50" : "border-[#cbd5e1]"
                  }`}
                />
                {passwordErrors.newPassword && (
                  <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                    {passwordErrors.newPassword}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Xác nhận mật khẩu mới"
                  className={`w-full p-3.5 rounded-xl border bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all ${
                    passwordErrors.confirmPassword ? "border-red-400 focus:ring-red-400/50" : "border-[#cbd5e1]"
                  }`}
                />
                {passwordErrors.confirmPassword && (
                  <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                    {passwordErrors.confirmPassword}
                  </span>
                )}
              </div>
              <div className="flex gap-3 justify-end mt-2">
                <button type="button" className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-[#f3f4f6] text-[#1f2937] border border-[#e5e7eb] hover:bg-[#e5e7eb]" onClick={() => setIsPasswordModalOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-profile-primary text-white hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
                  Cập nhật mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isVoucherModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9999] p-5">
          <div className="bg-white rounded-2xl w-full max-w-[500px] p-6 shadow-xl border border-[#e2e8f0] animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-[#f1f5f9]">
              <h3 className="m-0 text-xl font-extrabold text-[#0f172a]">Ví Voucher của bạn</h3>
              <button type="button" className="w-8 h-8 rounded bg-[#f1f5f9] border-none text-[#64748b] text-[1.2rem] cursor-pointer transition-all flex items-center justify-center hover:bg-[#e2e8f0] hover:text-[#0f172a]" onClick={() => setIsVoucherModalOpen(false)}>
                ✕
              </button>
            </div>
            <p className="m-0 mb-4 text-[#6b7280] text-[0.9rem] leading-normal mt-4">Danh sách các mã giảm giá bạn có thể sử dụng ngay.</p>
            
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              {(() => {
                const now = new Date();
                const activeVouchers = vouchers.filter(
                  v => !v.endDate || new Date(v.endDate) >= now
                );

                if (activeVouchers.length === 0) {
                  return <p className="text-center py-6 text-[#6b7280] text-sm">Bạn hiện chưa có mã giảm giá nào.</p>;
                }

                return activeVouchers.map(v => (
                  <div key={v.id} className="border border-dashed border-[#818cf8] rounded-xl p-4 bg-profile-primary-lighter flex justify-between items-center">
                    <div>
                      <h4 className="m-0 mb-1 text-profile-primary font-bold">{v.code}</h4>
                      <p className="m-0 text-[0.85rem] text-[#6b7280]">
                        Giảm {v.type === "percent" ? `${v.value}%` : `${Number(v.value).toLocaleString("vi-VN")}đ`} 
                        {Number(v.minOrderValue) > 0 && ` cho đơn từ ${Number(v.minOrderValue).toLocaleString("vi-VN")}đ`}
                        {Number(v.maxDiscountValue) > 0 && ` (Tối đa ${Number(v.maxDiscountValue).toLocaleString("vi-VN")}đ)`}
                      </p>
                      {v.endDate && (
                        <p className="mt-1 text-[0.8rem] text-accent-amber font-semibold">
                          HSD: {new Date(v.endDate).toLocaleString("vi-VN")}
                        </p>
                      )}
                    </div>
                    <button 
                      type="button" 
                      className="px-3 py-1.5 font-bold rounded-lg text-[0.85rem] transition-all cursor-pointer bg-profile-primary text-white hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
                      onClick={() => {
                        navigator.clipboard.writeText(v.code);
                        success(`Đã copy mã ${v.code}`);
                      }}
                    >
                      Copy mã
                    </button>
                  </div>
                ));
              })()}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-[#f3f4f6] text-[#1f2937] border border-[#e5e7eb] hover:bg-[#e5e7eb] w-full"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {isRedeemModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9999] p-5">
          <div className="bg-white rounded-2xl w-full max-w-[520px] p-6 shadow-xl border border-[#e2e8f0] animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-[#f1f5f9]">
              <h3 className="m-0 text-xl font-extrabold text-[#0f172a]">Đổi điểm lấy Voucher</h3>
              <button type="button" className="w-8 h-8 rounded bg-[#f1f5f9] border-none text-[#64748b] text-[1.2rem] cursor-pointer transition-all flex items-center justify-center hover:bg-[#e2e8f0] hover:text-[#0f172a]" onClick={() => setIsRedeemModalOpen(false)}>
                ✕
              </button>
            </div>

            <div className="text-center py-4.5 border-b border-[#e2eaf4] mb-4">
              <p className="m-0 mb-1 text-[0.9rem] text-[#62728a]">Số dư hiện tại</p>
              <strong className="text-[2rem] text-profile-primary">{loyaltyPoints.toLocaleString("vi-VN")}</strong>
              <span className="text-[1rem] text-[#62728a] ml-1.5">điểm</span>
            </div>

            <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
              {rewardTiers.length === 0 ? (
                <p className="text-center py-6 text-[#6b7280] text-sm">Chưa có mức đổi thưởng nào. Vui lòng quay lại sau.</p>
              ) : (
                rewardTiers.map(tier => {
                  const canRedeem = loyaltyPoints >= tier.pointsRequired;
                  const missingPoints = tier.pointsRequired - loyaltyPoints;

                  return (
                    <div key={tier._id} className={`border rounded-lg p-3 flex justify-between items-center transition-all ${
                      canRedeem 
                        ? "border-[#b5ccf0] bg-[#f8fbff] opacity-100" 
                        : "border-dashed border-[#e2eaf4] bg-[#f8f9fa] opacity-70"
                    }`}>
                      <div>
                        <h4 className={`m-0 mb-1 font-bold ${canRedeem ? "text-profile-primary" : "text-[#888]"}`}>{tier.name}</h4>
                        <p className="m-0 text-[0.85rem] text-[#62728a]">
                          {tier.pointsRequired.toLocaleString("vi-VN")} điểm →{" "}
                          Giảm {tier.discountType === "percent" ? `${tier.discountValue}%` : `${Number(tier.discountValue).toLocaleString("vi-VN")}đ`}
                          {Number(tier.maxDiscountValue) > 0 && ` (tối đa ${Number(tier.maxDiscountValue).toLocaleString("vi-VN")}đ)`}
                        </p>
                        {Number(tier.minOrderValue) > 0 && (
                          <p className="mt-0.5 text-[0.8rem] text-[#888]">
                            Đơn tối thiểu {Number(tier.minOrderValue).toLocaleString("vi-VN")}đ · Hiệu lực {tier.voucherValidDays} ngày
                          </p>
                        )}
                        {!canRedeem && (
                          <p className="mt-1 text-[0.8rem] text-[#b42318] font-semibold">
                            Còn thiếu {missingPoints.toLocaleString("vi-VN")} điểm
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!canRedeem || isRedeeming}
                        className="px-4 py-2 text-[0.85rem] rounded-md whitespace-nowrap font-bold transition-all bg-profile-primary text-white hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#9ca3af] disabled:shadow-none disabled:transform-none"
                        onClick={() => handleRedeem(tier._id)}
                      >
                        {isRedeeming ? "Đang đổi..." : "Đổi ngay"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {pointHistory.length > 0 && (
              <div className="mt-5 border-t border-[#e2eaf4] pt-4">
                <h4 className="m-0 mb-2.5 text-[0.9rem] text-[#62728a]">Lịch sử gần đây</h4>
                <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
                  {pointHistory.slice(0, 8).map(h => (
                    <div key={h._id} className="flex justify-between text-[0.82rem] py-1">
                      <span className="text-[#62728a]">{h.reason}</span>
                      <span className={`font-bold ${h.amount >= 0 ? "text-[#166534]" : "text-[#b42318]"}`}>
                        {h.amount >= 0 ? "+" : ""}{h.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-5">
              <button
                type="button"
                onClick={() => setIsRedeemModalOpen(false)}
                className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-[#f3f4f6] text-[#1f2937] border border-[#e5e7eb] hover:bg-[#e5e7eb] w-full"
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