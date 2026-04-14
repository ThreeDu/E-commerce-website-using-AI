import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import "../css/header.css";

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path fill="currentColor" d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2ZM7.17 14h9.92a2 2 0 0 0 1.87-1.25l2.6-6A1 1 0 0 0 20.64 5H6.21l-.37-1.57A2 2 0 0 0 3.9 2H2v2h1.9l2.16 9.1A3 3 0 0 0 9 15h10v-2H9.03a1 1 0 0 1-.97-.76Z" />
    </svg>
  );
}

function IconOrder() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M4 3h16a1 1 0 0 1 1 1v4h-2V5H5v14h14v-3h2v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm5 8 1.41 1.41L21.83 1l1.41 1.41-12.83 12.83L7.59 12.4Z" />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M12 2a5 5 0 1 1-5 5 5 5 0 0 1 5-5Zm0 12c4.42 0 8 2.24 8 5v1H4v-1c0-2.76 3.58-5 8-5Z" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M10 3h6a2 2 0 0 1 2 2v3h-2V5h-6v14h6v-3h2v3a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7.59 5.59L19 10l-2 2h-6v2h6l2 2 1.41-1.41L19.83 13l1.58-1.59L20 10l-2.41-2.41Z" />
    </svg>
  );
}

function Header() {
  const { auth, logout } = useAuth();
  const { cart } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = auth?.user?.role === "admin";
  const isAdminArea = isAdmin && location.pathname.startsWith("/admin");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const accountMenuRef = useRef(null);

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
    setIsAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!accountMenuRef.current) {
        return;
      }

      if (!accountMenuRef.current.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

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

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const keyword = String(searchKeyword || "").trim();

    if (!keyword) {
      return;
    }

    navigate(`/products?keyword=${encodeURIComponent(keyword)}`);
  };

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link to="/" className="brand-link" aria-label="AI Shop home">
          <h1 className="brand">AI Shop</h1>
        </Link>

        <nav className="nav-menu" aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link to="/products">Shop</Link>
          <a href="/#about">About</a>
          <a href="/#contact">Contact</a>
        </nav>

        <form className="nav-search" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
          />
          <button type="submit">Search</button>
        </form>

        <div className="nav-actions">
          <Link to="/cart" className="icon-action" aria-label="Cart">
            <IconCart />
            <span>Cart</span>
            {totalItems > 0 ? <span className="cart-count">{totalItems}</span> : null}
          </Link>

          {!auth ? (
            <Link to="/login" className="auth-cta">Login</Link>
          ) : (
            <div className="account-dropdown" ref={accountMenuRef}>
              <button
                type="button"
                className={`account-dropdown-trigger ${isAccountMenuOpen ? "open" : ""}`}
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              >
                <span className="header-layered-avatar" aria-hidden="true">
                  <span className="layer layer-back" />
                  <span className="layer layer-middle" />
                  <span className="layer layer-front">{String(auth?.user?.name || "T").slice(0, 1).toUpperCase()}</span>
                </span>
                <span className="account-label">Account</span>
                <span className="caret">▾</span>
              </button>

              <div className={`account-dropdown-menu ${isAccountMenuOpen ? "open" : ""}`} role="menu">
                <Link to="/profile" className="account-menu-item" role="menuitem">
                  <span className="icon-wrap"><IconProfile /></span>
                  <span>My Profile</span>
                </Link>
                <Link to="/order-history" className="account-menu-item" role="menuitem">
                  <span className="icon-wrap"><IconOrder /></span>
                  <span>My Orders</span>
                </Link>
                <div className="account-menu-divider" aria-hidden="true" />
                <button type="button" className="account-menu-item logout-item" role="menuitem" onClick={logout}>
                  <span className="icon-wrap"><IconLogout /></span>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
