/**
 * Admin sidebar navigation.
 *
 * Extracted from Header to separate admin and user-facing layouts.
 * Updated with a premium, glassmorphism design ("Modern Glass Sidebar").
 */
import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faBoxOpen,
  faBrain,
  faCartShopping,
  faFileLines,
  faGaugeHigh,
  faGift,
  faTags,
  faTableCellsLarge,
  faUsers,
  faBullhorn,
  faCube,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

function AdminSidebar({ isSidebarOpen, onToggleSidebar, onLogout }) {
  // Navigation links array
  const navItems = [
    { to: "/admin/dashboard", icon: faGaugeHigh, label: "Bảng điều khiển", tooltip: "Bảng điều khiển" },
    { to: "/admin/notifications", icon: faBell, label: "Trung tâm thông báo", tooltip: "Thông báo" },
    { to: "/admin/intelligence", icon: faBrain, label: "AI phân tích dự đoán", tooltip: "AI Analytics" },
    { to: "/admin/retention", icon: faBullhorn, label: "Chiến dịch giữ chân", tooltip: "Giữ chân KH" },
    { to: "/admin/categories", icon: faTableCellsLarge, label: "Quản lý danh mục", tooltip: "Danh mục" },
    { to: "/admin/products", icon: faBoxOpen, label: "Quản lý sản phẩm", tooltip: "Sản phẩm" },
    { to: "/admin/discounts", icon: faTags, label: "Quản lý mã giảm giá", tooltip: "Mã giảm giá" },
    { to: "/admin/rewards", icon: faGift, label: "Đổi thưởng điểm", tooltip: "Đổi thưởng" },
    { to: "/admin/orders", icon: faCartShopping, label: "Quản lý đơn hàng", tooltip: "Đơn hàng" },
    { to: "/admin/users", icon: faUsers, label: "Quản lý người dùng", tooltip: "Người dùng" },
    { to: "/admin/system-logs", icon: faFileLines, label: "Log hệ thống", tooltip: "Log hệ thống" },
  ];

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        type="button"
        className="hidden max-[960px]:inline-flex items-center justify-center fixed top-3 left-3 z-[1150] w-10 h-10 border-none rounded-[10px] bg-[#0b1f33]/80 backdrop-blur-md text-white text-xl cursor-pointer shadow-[0_8px_20px_rgba(8,28,43,0.25)] hover:bg-[#0b1f33] transition-colors"
        onClick={() => onToggleSidebar(true)}
        aria-label="Mở menu quản trị"
      >
        ☰
      </button>

      {/* Sidebar Aside Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 bg-[#0b1f33]/85 backdrop-blur-xl border-r border-white/10 text-[#e6eef7] py-5 px-3 flex flex-col gap-4 shadow-[10px_0_30px_rgba(6,14,23,0.3)] z-[1100] group admin-sidebar-glass transition-[width,transform] duration-300 ease-out
          max-[960px]:w-[280px] max-[960px]:transition-transform max-[960px]:duration-[250ms] max-[960px]:ease-in-out
          min-[961px]:w-[80px] min-[961px]:hover:w-[280px]
          ${isSidebarOpen ? "max-[960px]:translate-x-0" : "max-[960px]:-translate-x-[105%]"}`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between w-full shrink-0 border-b border-white/5 pb-4">
          <div className="flex items-center h-[50px] w-full
            min-[961px]:justify-center
            min-[961px]:group-hover:justify-start
            max-[960px]:justify-start"
          >
            <span className="text-2xl text-[#00ff88] min-w-[35px] flex items-center justify-center shrink-0 drop-shadow-[0_0_8px_rgba(0,255,136,0.4)]" aria-hidden="true">
              <FontAwesomeIcon icon={faCube} />
            </span>
            <span className="text-[1.15rem] text-[#f4f9ff] font-extrabold tracking-wider whitespace-nowrap transition-all duration-300
              min-[961px]:opacity-0 min-[961px]:w-0 min-[961px]:overflow-hidden min-[961px]:ml-0
              min-[961px]:group-hover:opacity-100 min-[961px]:group-hover:w-auto min-[961px]:group-hover:ml-2
              max-[960px]:opacity-100 max-[960px]:w-auto max-[960px]:ml-2"
            >
              ADMIN CONTROL
            </span>
          </div>
          <button
            type="button"
            className="hidden max-[960px]:inline-flex items-center justify-center w-[30px] h-[30px] border-none rounded-lg bg-white/[0.1] text-white cursor-pointer text-lg hover:bg-white/20 transition-colors shrink-0"
            onClick={() => onToggleSidebar(false)}
            aria-label="Đóng menu quản trị"
          >
            ×
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex flex-col gap-1.5 mt-2 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex-1 pr-0.5">
          {navItems.map((item) => (
            <div key={item.to} className="admin-sidebar-nav-item" data-tooltip={item.tooltip}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `w-full h-12 flex items-center justify-center transition-all duration-300 no-underline whitespace-nowrap rounded-xl hover:bg-[#00ff88]/10 hover:text-[#00ff88]
                  /* Desktop collapsed */
                  min-[961px]:justify-center min-[961px]:p-0
                  /* Desktop expanded */
                  min-[961px]:group-hover:justify-start min-[961px]:group-hover:px-4
                  /* Mobile */
                  max-[960px]:justify-start max-[960px]:px-4
                  ${
                    isActive
                      ? "bg-[#00ff88] text-[#121212] font-extrabold hover:bg-[#00ff88] hover:text-[#121212]"
                      : "text-[#888888]"
                  }`
                }
              >
                <span className="min-w-[35px] flex items-center justify-center text-[1.2rem] shrink-0" aria-hidden="true">
                  <FontAwesomeIcon icon={item.icon} />
                </span>
                <span className="font-semibold tracking-[0.01em] transition-all duration-300
                  min-[961px]:opacity-0 min-[961px]:w-0 min-[961px]:overflow-hidden min-[961px]:ml-0
                  min-[961px]:group-hover:opacity-100 min-[961px]:group-hover:w-auto min-[961px]:group-hover:ml-3
                  max-[960px]:opacity-100 max-[960px]:w-auto max-[960px]:ml-3"
                >
                  {item.label}
                </span>
              </NavLink>
            </div>
          ))}
        </nav>

        {/* Footer Area with Logout Button */}
        <div className="admin-sidebar-nav-item mt-auto pt-4 border-t border-white/5 shrink-0" data-tooltip="Đăng xuất">
          <button
            type="button"
            className="w-full h-12 flex items-center justify-center transition-all duration-300 no-underline whitespace-nowrap rounded-xl bg-transparent border-none cursor-pointer text-[#ef4444] hover:bg-[#ef4444]/15 hover:text-[#ff6b6b]
              /* Desktop collapsed */
              min-[961px]:justify-center min-[961px]:p-0
              /* Desktop expanded */
              min-[961px]:group-hover:justify-start min-[961px]:group-hover:px-4
              /* Mobile */
              max-[960px]:justify-start max-[960px]:px-4"
            onClick={onLogout}
          >
            <span className="min-w-[35px] flex items-center justify-center text-[1.2rem] shrink-0" aria-hidden="true">
              <FontAwesomeIcon icon={faRightFromBracket} />
            </span>
            <span className="font-semibold tracking-[0.01em] transition-all duration-300
              min-[961px]:opacity-0 min-[961px]:w-0 min-[961px]:overflow-hidden min-[961px]:ml-0
              min-[961px]:group-hover:opacity-100 min-[961px]:group-hover:w-auto min-[961px]:group-hover:ml-3
              max-[960px]:opacity-100 max-[960px]:w-auto max-[960px]:ml-3"
            >
              Đăng xuất
            </span>
          </button>
        </div>
      </aside>

      {/* Overlay Backdrop for Mobile */}
      {isSidebarOpen && (
        <button
          type="button"
          className="hidden max-[960px]:block fixed inset-0 z-[1080] border-none bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => onToggleSidebar(false)}
          aria-label="Đóng menu"
        />
      )}
    </>
  );
}

export default AdminSidebar;
