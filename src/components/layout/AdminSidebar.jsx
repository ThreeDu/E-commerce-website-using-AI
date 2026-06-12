/**
 * Admin sidebar navigation.
 *
 * Extracted from Header to separate admin and user-facing layouts.
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
} from "@fortawesome/free-solid-svg-icons";


function AdminSidebar({ isSidebarOpen, onToggleSidebar, onLogout }) {
  return (
    <>
      <button
        type="button"
        className="hidden max-[960px]:inline-flex items-center justify-center fixed top-3 left-3 z-[1150] w-10 h-10 border-none rounded-[10px] bg-[#10375c] text-white text-xl cursor-pointer shadow-[0_8px_20px_rgba(8,28,43,0.25)]"
        onClick={() => onToggleSidebar(true)}
        aria-label="Mở menu quản trị"
      >
        ☰
      </button>

      <aside className={`fixed top-0 left-0 bottom-0 w-[272px] bg-gradient-to-b from-admin-sidebar-start to-admin-sidebar-end text-[#e6eef7] py-3.5 px-3 flex flex-col gap-3.5 shadow-[10px_0_28px_rgba(6,14,23,0.26)] overflow-hidden z-[1100] max-[960px]:transition-transform max-[960px]:duration-[250ms] max-[960px]:ease-in-out ${isSidebarOpen ? "max-[960px]:translate-x-0" : "max-[960px]:-translate-x-[105%]"}`}>
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-[1.18rem] text-[#f4f9ff] font-extrabold">Admin Control Panel</h1>
          <button
            type="button"
            className="hidden max-[960px]:inline-flex items-center justify-center w-[30px] h-[30px] border-none rounded-lg bg-white/[0.14] text-white cursor-pointer text-lg"
            onClick={() => onToggleSidebar(false)}
            aria-label="Đóng menu quản trị"
          >
            ×
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 mt-2">
          <NavLink to="/admin/dashboard" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className={`min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]`} aria-hidden="true"><FontAwesomeIcon icon={faGaugeHigh} /></span>
            <span className="font-semibold tracking-[0.01em]">Bảng điều khiển</span>
          </NavLink>
          <NavLink to="/admin/notifications" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faBell} /></span>
            <span className="font-semibold tracking-[0.01em]">Trung tâm thông báo</span>
          </NavLink>

          <NavLink to="/admin/intelligence" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faBrain} /></span>
            <span className="font-semibold tracking-[0.01em]">AI phân tích dự đoán</span>
          </NavLink>
          <NavLink to="/admin/retention" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faBullhorn} /></span>
            <span className="font-semibold tracking-[0.01em]">Chiến dịch giữ chân</span>
          </NavLink>

          <NavLink to="/admin/categories" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faTableCellsLarge} /></span>
            <span className="font-semibold tracking-[0.01em]">Quản lý danh mục</span>
          </NavLink>
          <NavLink to="/admin/products" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faBoxOpen} /></span>
            <span className="font-semibold tracking-[0.01em]">Quản lý sản phẩm</span>
          </NavLink>
          <NavLink to="/admin/discounts" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faTags} /></span>
            <span className="font-semibold tracking-[0.01em]">Quản lý mã giảm giá</span>
          </NavLink>
          <NavLink to="/admin/rewards" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faGift} /></span>
            <span className="font-semibold tracking-[0.01em]">Đổi thưởng điểm</span>
          </NavLink>
          <NavLink to="/admin/orders" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faCartShopping} /></span>
            <span className="font-semibold tracking-[0.01em]">Quản lý đơn hàng</span>
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faUsers} /></span>
            <span className="font-semibold tracking-[0.01em]">Quản lý người dùng</span>
          </NavLink>
          <NavLink to="/admin/system-logs" className={({ isActive }) => `admin-sidebar-link no-underline text-[#d8e7f7] min-h-[56px] px-3 rounded-[18px] border border-transparent flex items-center gap-2.5 transition-all duration-[240ms] hover:bg-[#f4f8ff] hover:text-[#0f314f] ${isActive ? "bg-white text-[#0f314f] !border-white" : ""}`}>
            <span className="min-w-[30px] w-[30px] h-[30px] rounded-full inline-flex items-center justify-center text-sm font-bold border border-[rgba(216,231,247,0.22)] bg-white/10 text-[#d8e7f7]" aria-hidden="true"><FontAwesomeIcon icon={faFileLines} /></span>
            <span className="font-semibold tracking-[0.01em]">Log hệ thống</span>
          </NavLink>
        </nav>

        <div className="mt-auto">
          <button type="button" className="w-full text-[#f4f9ff] border border-[rgba(216,231,247,0.28)] rounded-xl py-2.5 px-3 bg-white/[0.08] cursor-pointer font-bold hover:bg-white/[0.18] transition-colors" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          className="hidden max-[960px]:block fixed inset-0 z-[1080] border-none bg-black/[0.38]"
          onClick={() => onToggleSidebar(false)}
          aria-label="Đóng menu"
        />
      )}
    </>
  );
}

export default AdminSidebar;
