/**
 * Admin Sidebar Navigation Component
 * Modern-Minimal Enterprise Navigation with grouped categories,
 * collapsible states, and smooth responsive drawer support.
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
  faRobot,
  faXmark,
  faAnglesLeft,
  faAnglesRight,
  faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";

const NAV_GROUPS = [
  {
    title: "Tổng quan",
    items: [
      { to: "/admin/dashboard", icon: faGaugeHigh, label: "Bảng điều khiển", tooltip: "Bảng điều khiển" },
      { to: "/admin/notifications", icon: faBell, label: "Trung tâm thông báo", tooltip: "Thông báo" },
    ],
  },
  {
    title: "Vận hành & Bán hàng",
    items: [
      { to: "/admin/orders", icon: faCartShopping, label: "Quản lý đơn hàng", tooltip: "Đơn hàng" },
      { to: "/admin/products", icon: faBoxOpen, label: "Quản lý sản phẩm", tooltip: "Sản phẩm" },
      { to: "/admin/categories", icon: faTableCellsLarge, label: "Quản lý danh mục", tooltip: "Danh mục" },
      { to: "/admin/discounts", icon: faTags, label: "Quản lý mã giảm giá", tooltip: "Mã giảm giá" },
      { to: "/admin/rewards", icon: faGift, label: "Đổi thưởng điểm", tooltip: "Đổi thưởng" },
    ],
  },
  {
    title: "Khách hàng & AI",
    items: [
      { to: "/admin/users", icon: faUsers, label: "Quản lý người dùng", tooltip: "Người dùng" },
      { to: "/admin/intelligence", icon: faBrain, label: "AI phân tích dự đoán", tooltip: "AI Analytics" },
      { to: "/admin/chatbot", icon: faRobot, label: "Trợ lý AI Admin", tooltip: "Trợ lý AI" },
      { to: "/admin/retention", icon: faBullhorn, label: "Chiến dịch giữ chân", tooltip: "Giữ chân KH" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { to: "/admin/system-logs", icon: faFileLines, label: "Log hệ thống", tooltip: "Log hệ thống" },
    ],
  },
];

function AdminSidebar({
  isSidebarOpen,
  onToggleSidebar,
  isCollapsed = false,
  onToggleCollapse,
  onLogout,
}) {
  return (
    <>
      {/* Sidebar Aside Panel */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-[1100] flex flex-col bg-slate-900 border-r border-slate-800 text-slate-200 select-none transition-all duration-200 ease-out shadow-xl
          /* Width on desktop */
          ${isCollapsed ? "lg:w-[76px]" : "lg:w-[260px]"}
          /* Drawer on mobile/tablet */
          w-[280px] max-w-[85vw]
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs shadow-blue-500/20">
              <FontAwesomeIcon icon={faCube} className="text-base" />
            </div>
            <div className={`flex flex-col min-w-0 transition-opacity duration-200 ${isCollapsed ? "lg:hidden" : ""}`}>
              <span className="text-sm font-extrabold tracking-wider text-white whitespace-nowrap leading-none">
                ADMIN PORTAL
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase mt-1 leading-none">
                E-Commerce AI
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          <button
            type="button"
            onClick={() => onToggleSidebar(false)}
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Đóng menu quản trị"
          >
            <FontAwesomeIcon icon={faXmark} className="text-lg" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-slate-700"
          aria-label="Menu quản trị chính"
        >
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="flex flex-col gap-1">
              <div className={`px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 ${isCollapsed ? "lg:hidden" : ""}`}>
                {group.title}
              </div>
              {isCollapsed && (
                <div className="hidden lg:block h-px bg-slate-800/60 my-1 mx-2" aria-hidden="true" />
              )}

              {group.items.map((item) => (
                <div
                  key={item.to}
                  className="admin-sidebar-nav-item"
                  data-tooltip={item.tooltip}
                >
                  <NavLink
                    to={item.to}
                    onClick={() => onToggleSidebar(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl transition-colors font-medium text-xs sm:text-sm no-underline ${
                        isCollapsed
                          ? "h-10 px-3 justify-start lg:w-11 lg:h-11 lg:mx-auto lg:justify-center lg:p-0"
                          : "h-10 px-3 justify-start"
                      } ${
                        isActive
                          ? "bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30"
                          : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                      }`
                    }
                  >
                    <span className="w-5 flex items-center justify-center text-sm shrink-0" aria-hidden="true">
                      <FontAwesomeIcon icon={item.icon} />
                    </span>
                    <span className={`truncate tracking-[0.01em] ${isCollapsed ? "lg:hidden" : ""}`}>
                      {item.label}
                    </span>
                  </NavLink>
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 flex flex-col gap-1.5 shrink-0 bg-slate-900/90">
          {/* Quick link: View Storefront (Useful on mobile/sidebar) */}
          <NavLink
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors no-underline ${
              isCollapsed
                ? "h-9 px-3 justify-start lg:w-11 lg:h-11 lg:mx-auto lg:justify-center"
                : "h-9 px-3"
            }`}
            title="Xem giao diện khách hàng"
          >
            <span className="w-5 flex items-center justify-center text-sm shrink-0">
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </span>
            <span className={`truncate ${isCollapsed ? "lg:hidden" : ""}`}>Cửa hàng</span>
          </NavLink>

          {/* Desktop collapse toggle */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`hidden lg:flex items-center gap-3 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer border-none bg-transparent ${
                isCollapsed ? "w-11 h-11 mx-auto justify-center" : "h-9 px-3"
              }`}
              title={isCollapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu"}
            >
              <span className="w-5 flex items-center justify-center text-sm shrink-0">
                <FontAwesomeIcon icon={isCollapsed ? faAnglesRight : faAnglesLeft} />
              </span>
              {!isCollapsed && <span className="truncate">Thu gọn menu</span>}
            </button>
          )}

          {/* Logout button */}
          <button
            type="button"
            onClick={onLogout}
            className={`flex items-center gap-3 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer border-none bg-transparent ${
              isCollapsed
                ? "h-9 px-3 justify-start lg:w-11 lg:h-11 lg:mx-auto lg:justify-center"
                : "h-9 px-3"
            }`}
            title="Đăng xuất"
          >
            <span className="w-5 flex items-center justify-center text-sm shrink-0">
              <FontAwesomeIcon icon={faRightFromBracket} />
            </span>
            <span className={`truncate ${isCollapsed ? "lg:hidden" : ""}`}>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Backdrop overlay for mobile drawer */}
      {isSidebarOpen && (
        <button
          type="button"
          onClick={() => onToggleSidebar(false)}
          className="lg:hidden fixed inset-0 z-[1090] bg-slate-950/60 backdrop-blur-xs border-none cursor-pointer animate-fade-in"
          aria-label="Đóng thanh điều hướng"
        />
      )}
    </>
  );
}

export default AdminSidebar;
