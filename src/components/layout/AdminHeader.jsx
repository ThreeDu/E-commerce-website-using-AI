import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faAnglesLeft,
  faAnglesRight,
  faArrowUpRightFromSquare,
  faBell,
  faRightFromBracket,
  faHouse,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../context/AuthContext";

const BREADCRUMB_MAP = {
  "/admin/dashboard": "Bảng điều khiển",
  "/admin/notifications": "Trung tâm thông báo",
  "/admin/intelligence": "AI Phân tích dự đoán",
  "/admin/chatbot": "Trợ lý AI Admin",
  "/admin/retention": "Chiến dịch giữ chân",
  "/admin/categories": "Quản lý danh mục",
  "/admin/products": "Quản lý sản phẩm",
  "/admin/products/add": "Thêm sản phẩm mới",
  "/admin/products/bulk": "Nhập hàng loạt sản phẩm",
  "/admin/discounts": "Quản lý mã giảm giá",
  "/admin/discounts/add": "Thêm mã giảm giá",
  "/admin/rewards": "Đổi thưởng điểm",
  "/admin/orders": "Quản lý đơn hàng",
  "/admin/users": "Quản lý người dùng",
  "/admin/system-logs": "Log hệ thống",
};

function getPageTitle(pathname) {
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  if (pathname.startsWith("/admin/products/edit/")) return "Chỉnh sửa sản phẩm";
  if (pathname.startsWith("/admin/discounts/edit/")) return "Chỉnh sửa mã giảm giá";
  if (pathname.startsWith("/admin/rewards/edit/")) return "Chỉnh sửa hạn mức đổi thưởng";
  return "Khu vực Quản trị";
}

function AdminHeader({ onToggleSidebar, isCollapsed, onToggleCollapse, onLogout }) {
  const { auth } = useAuth();
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);
  const userName = auth?.user?.name || "Admin";
  const userInitial = userName.charAt(0).toUpperCase() || "A";

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 transition-all duration-200">
      {/* Left side: Navigation controls & Breadcrumbs */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => onToggleSidebar(true)}
          className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Mở menu quản trị"
        >
          <FontAwesomeIcon icon={faBars} className="text-base" />
        </button>

        {/* Desktop sidebar collapse/expand toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title={isCollapsed ? "Mở rộng menu (Ctrl+B)" : "Thu gọn menu (Ctrl+B)"}
          aria-label="Đổi chế độ menu bên"
        >
          <FontAwesomeIcon icon={isCollapsed ? faAnglesRight : faAnglesLeft} className="text-sm" />
        </button>

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm">
          <Link
            to="/admin/dashboard"
            className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 shrink-0"
            title="Trang chủ Admin"
          >
            <FontAwesomeIcon icon={faHouse} className="text-xs" />
            <span className="hidden sm:inline font-medium">Admin</span>
          </Link>
          <FontAwesomeIcon icon={faChevronRight} className="text-[10px] text-slate-300 shrink-0" />
          <span className="font-bold text-slate-900 whitespace-nowrap text-sm sm:text-base">
            {pageTitle}
          </span>
        </nav>
      </div>

      {/* Right side: Live status, Storefront link, Notifications, Admin Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Real-time system pulse indicator */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>Trực tuyến</span>
        </div>

        {/* Quick link: View Storefront */}
        <Link
          to="/"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-blue-600 text-xs font-semibold transition-all shadow-2xs"
          title="Mở giao diện khách hàng trong tab mới"
        >
          <span>Xem cửa hàng</span>
          <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px]" />
        </Link>

        {/* Notifications Icon Button */}
        <Link
          to="/admin/notifications"
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-colors"
          title="Trung tâm thông báo"
          aria-label="Thông báo"
        >
          <FontAwesomeIcon icon={faBell} className="text-sm" />
        </Link>

        {/* Admin Profile & Quick Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 select-none">
            {userInitial}
          </div>
          <div className="hidden 2xl:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
              {userName}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              Quản trị viên
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-none bg-transparent"
            title="Đăng xuất khỏi hệ thống"
            aria-label="Đăng xuất"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="text-sm" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
