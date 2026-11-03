import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { getMyWeeklyStats, trackEvent } from "../../services/analyticsService";
import { changePassword, updateProfile } from "../../services/auth/authService";
import { fetchWishlist, removeFromWishlist } from "../../services/wishlistService";
import { fetchMyOrders, fetchMyVouchers } from "../../services/orderService";
import { getMyPoints, getRewards, redeemPoints } from "../../services/pointService";
import RedeemPointsModal from "./RedeemPointsModal";
import VoucherWalletModal from "./VoucherWalletModal";
import ChangePasswordModal from "./ChangePasswordModal";
import ProfileEditForm from "./ProfileEditForm";
import WishlistOrdersSection from "./WishlistOrdersSection";
import ProfileSummaryCard from "./ProfileSummaryCard";
import WeeklyStatsPanel from "./WeeklyStatsPanel";
import DashboardSidebar from "./DashboardSidebar";
import { IconMenuUser, IconMenuStats, IconMenuOrders, IconHeart, IconMenuVoucher, IconMenuAddress, IconMenuCard, IconMenuLock, IconMenuLogout, IconGift } from "./dashboardIcons";

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
        const data = await fetchMyOrders(auth.token);
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
        const data = await fetchWishlist(auth.token);
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
      const data = await getMyWeeklyStats(auth.token);
      setWeeklyStats(data);
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

  const handleRemoveWishlistItem = async (productId) => {
    if (!auth?.token || !productId) {
      return;
    }

    try {
      const removedItem = wishlist.find((item) => String(item?._id) === String(productId));

      const data = await removeFromWishlist(productId, auth.token);
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
    } catch (err) {
      error(
        err.status
          ? err.data?.message || "Không thể xóa sản phẩm khỏi yêu thích."
          : "Lỗi kết nối đến máy chủ.",
        { title: "Yêu thích" }
      );
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
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }, auth?.token);

      success("Đổi mật khẩu thành công.", { title: "Tài khoản" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordErrors({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setIsPasswordModalOpen(false);
      }, 900);
    } catch (err) {
      error(err.status ? err.message : "Lỗi kết nối đến máy chủ.", { title: "Đổi mật khẩu" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setProfileErrors({ name: "Vui lòng nhập họ và tên của bạn." });
      return;
    }
    try {
      const data = await updateProfile(formData, auth?.token);
      login({ token: auth.token, user: data.user });
      setAvatar(data.user.avatar || "");
      success("Cập nhật thông tin cá nhân thành công!", { title: "Hồ sơ" });
    } catch (err) {
      if (err.status) {
        error(err.message, { title: "Hồ sơ" });
        return;
      }
      console.error("Lỗi cập nhật:", err);
      error("Lỗi kết nối đến máy chủ.", { title: "Hồ sơ" });
    }
  };

  return (
    <main className="w-[min(1200px,95%)] mx-auto flex-1 py-10 px-4">
      <div className="grid grid-cols-[260px_1fr] gap-6 max-[960px]:grid-cols-1">
        <DashboardSidebar activeMenu={activeMenu} auth={auth} avatar={avatar} handleMenuAction={handleMenuAction} sidebarItems={sidebarItems} />

        <section className="grid gap-6">
          {activeMenu === "stats" ? (
            <WeeklyStatsPanel weeklyStats={weeklyStats} weeklyStatsLoading={weeklyStatsLoading} />
          ) : (
            <>
              <ProfileSummaryCard auth={auth} avatar={avatar} error={error} login={login} memberSince={memberSince} metrics={metrics} scrollToEditForm={scrollToEditForm} setAvatar={setAvatar} setIsRedeemModalOpen={setIsRedeemModalOpen} success={success} />

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

              <WishlistOrdersSection handleRemoveWishlistItem={handleRemoveWishlistItem} isWishlistLoading={isWishlistLoading} navigate={navigate} recentOrders={recentOrders} wishlist={wishlist} wishlistPreview={wishlistPreview} />

              <ProfileEditForm formData={formData} handleChange={handleChange} handleSubmit={handleSubmit} memberSince={memberSince} profileEditRef={profileEditRef} profileErrors={profileErrors} setIsPasswordModalOpen={setIsPasswordModalOpen} />
            </>
          )}
        </section>
      </div>

      <ChangePasswordModal handleChangePassword={handleChangePassword} handlePasswordChange={handlePasswordChange} isPasswordModalOpen={isPasswordModalOpen} passwordErrors={passwordErrors} passwordForm={passwordForm} setIsPasswordModalOpen={setIsPasswordModalOpen} />

      <VoucherWalletModal isVoucherModalOpen={isVoucherModalOpen} setIsVoucherModalOpen={setIsVoucherModalOpen} success={success} vouchers={vouchers} />

      <RedeemPointsModal handleRedeem={handleRedeem} isRedeemModalOpen={isRedeemModalOpen} isRedeeming={isRedeeming} loyaltyPoints={loyaltyPoints} pointHistory={pointHistory} rewardTiers={rewardTiers} setIsRedeemModalOpen={setIsRedeemModalOpen} />
    </main>
  );
}

export default UserDashboard;