import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import "../css/header.css";

function Header() {
  const { auth, logout } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const isAdmin = auth?.user?.role === "admin";
  const isAdminArea = isAdmin && location.pathname.startsWith("/admin");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Tính tổng số lượng sản phẩm có trong giỏ hàng
  const totalItems = cart ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;

  useEffect(() => {
    if (isAdminArea) {
      document.body.classList.add("admin-sidebar-active");
    } else {
      document.body.classList.remove("admin-sidebar-active");
    }

    return () => {
      document.body.classList.remove("admin-sidebar-active");
    };
  }, [isAdminArea]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (isAdminArea) {
    return (
      <>
        <button
          type="button"
          className="sidebar-mobile-toggle"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Mở menu quản trị"
        >
          ☰
        </button>

        <aside className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}>
          <div className="admin-sidebar-header">
            <h1 className="brand">AI Shop</h1>
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Đóng menu quản trị"
            >
              ×
            </button>
          </div>

          <nav className="admin-sidebar-menu">
            <NavLink to="/admin/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
              Bảng điều khiển
            </NavLink>
            <NavLink to="/admin/categories" className={({ isActive }) => (isActive ? "active" : "")}>
              Quản lý danh mục
            </NavLink>
            <NavLink to="/admin/products" className={({ isActive }) => (isActive ? "active" : "")}>
              Quản lý sản phẩm
            </NavLink>
            <NavLink to="/admin/discounts" className={({ isActive }) => (isActive ? "active" : "")}>
              Quản lý mã giảm giá
            </NavLink>
            <NavLink to="/admin/orders" className={({ isActive }) => (isActive ? "active" : "")}>
              Quản lý đơn hàng
            </NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>
              Quản lý người dùng
            </NavLink>
            <NavLink to="/admin/system-logs" className={({ isActive }) => (isActive ? "active" : "")}> 
              Log hệ thống
            </NavLink>
          </nav>

          <div className="admin-sidebar-footer">
            <button type="button" className="logout-btn" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </aside>

        {isSidebarOpen && (
          <button
            type="button"
            className="admin-sidebar-backdrop"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Đóng menu"
          />
        )}
      </>
    );
  }

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <h1 className="brand">AI Shop</h1>
        <nav className="nav-menu">
          {isAdmin ? (
            <>
              <Link to="/admin/dashboard">Bảng điều khiển</Link>
              <Link to="/admin/categories">Quản lý danh mục</Link>
              <Link to="/admin/products">Quản lý sản phẩm</Link>
              <Link to="/admin/discounts">Quản lý mã giảm giá</Link>
              <Link to="/admin/orders">Quản lý đơn hàng</Link>
              <Link to="/admin/users">Quản lý người dùng</Link>
              <Link to="/admin/system-logs">Log hệ thống</Link>
            </>
          ) : (
            <>
              <Link to="/">Trang chủ</Link>
              <Link to="/products">Sản phẩm</Link>

              {!auth ? (
                <Link to="/login">Đăng nhập</Link>
              ) : (
                <div className="account-action-scroll" role="group" aria-label="Tác vụ tài khoản">
                  <Link
                    to="/cart"
                    className="account-action-chip cart-chip"
                    style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <span style={{ fontSize: "18px" }}>🛒</span>
                    <span>Giỏ hàng</span>
                    {totalItems > 0 && (
                      <span
                        style={{
                          backgroundColor: "#dc3545",
                          color: "white",
                          borderRadius: "999px",
                          padding: "2px 8px",
                          fontSize: "12px",
                          fontWeight: "bold",
                          lineHeight: 1.2,
                        }}
                      >
                        {totalItems}
                      </span>
                    )}
                  </Link>
                  <Link to="/order-history" className="account-action-chip">Lịch sử đơn hàng</Link>
                  <Link to="/profile" className="account-action-chip">Hồ sơ cá nhân</Link>
                  <button type="button" className="logout-btn account-action-chip" onClick={logout}>
                    Đăng xuất
                  </button>
                </div>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
