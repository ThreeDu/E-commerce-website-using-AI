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
  faCartShopping,
  faChartLine,
  faFileLines,
  faGaugeHigh,
  faTags,
  faTableCellsLarge,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

function AdminSidebar({ isSidebarOpen, onToggleSidebar, onLogout }) {
  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => onToggleSidebar(true)}
        aria-label="Mở menu quản trị"
      >
        ☰
      </button>

      <aside className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <h1 className="brand">Admin Control Panel</h1>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => onToggleSidebar(false)}
            aria-label="Đóng menu quản trị"
          >
            ×
          </button>
        </div>

        <nav className="admin-sidebar-menu">
          <NavLink to="/admin/dashboard" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faGaugeHigh} /></span>
            <span className="admin-sidebar-link-title">Bảng điều khiển</span>
          </NavLink>
          <NavLink to="/admin/notifications" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faBell} /></span>
            <span className="admin-sidebar-link-title">Trung tâm thông báo</span>
          </NavLink>
          <NavLink to="/admin/analytics" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faChartLine} /></span>
            <span className="admin-sidebar-link-title">Phễu phân tích</span>
          </NavLink>
          <NavLink to="/admin/categories" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faTableCellsLarge} /></span>
            <span className="admin-sidebar-link-title">Quản lý danh mục</span>
          </NavLink>
          <NavLink to="/admin/products" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faBoxOpen} /></span>
            <span className="admin-sidebar-link-title">Quản lý sản phẩm</span>
          </NavLink>
          <NavLink to="/admin/discounts" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faTags} /></span>
            <span className="admin-sidebar-link-title">Quản lý mã giảm giá</span>
          </NavLink>
          <NavLink to="/admin/orders" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faCartShopping} /></span>
            <span className="admin-sidebar-link-title">Quản lý đơn hàng</span>
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faUsers} /></span>
            <span className="admin-sidebar-link-title">Quản lý người dùng</span>
          </NavLink>
          <NavLink to="/admin/system-logs" className={({ isActive }) => `admin-sidebar-link ${isActive ? "active" : ""}`}>
            <span className="admin-sidebar-link-icon" aria-hidden="true"><FontAwesomeIcon icon={faFileLines} /></span>
            <span className="admin-sidebar-link-title">Log hệ thống</span>
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
          <button type="button" className="logout-btn" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          onClick={() => onToggleSidebar(false)}
          aria-label="Đóng menu"
        />
      )}
    </>
  );
}

export default AdminSidebar;
