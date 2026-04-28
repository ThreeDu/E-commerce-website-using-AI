import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
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

function getProductImageSrc(product) {
  const rawValue = String(product?.image || product?.imageUrl || "").trim();
  if (!rawValue) {
    return "/placeholder.svg";
  }

  if (
    rawValue.startsWith("http://") ||
    rawValue.startsWith("https://") ||
    rawValue.startsWith("data:image/") ||
    rawValue.startsWith("/")
  ) {
    return rawValue;
  }

  return `/${rawValue.replace(/^\/+/, "")}`;
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
  const [productIndex, setProductIndex] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const searchWrapRef = useRef(null);

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
    setIsSuggestOpen(false);
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

  useEffect(() => {
    const handleOutsideSearch = (event) => {
      if (!searchWrapRef.current) {
        return;
      }

      if (!searchWrapRef.current.contains(event.target)) {
        setIsSuggestOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideSearch);
    return () => {
      document.removeEventListener("mousedown", handleOutsideSearch);
    };
  }, []);

  useEffect(() => {
    if (isAdminArea) {
      return;
    }

    const loadProductIndex = async () => {
      try {
        const response = await fetch("/api/products");
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setProductIndex(Array.isArray(data) ? data : []);
      } catch (error) {
        // Silent fail to avoid blocking header.
      }
    };

    loadProductIndex();
  }, [isAdminArea]);

  useEffect(() => {
    const keyword = String(searchKeyword || "").trim().toLowerCase();
    if (!keyword) {
      setProductSuggestions([]);
      return;
    }

    const matches = productIndex.filter((product) =>
      String(product?.name || "").toLowerCase().includes(keyword)
    );

    setProductSuggestions(matches.slice(0, 6));
  }, [productIndex, searchKeyword]);

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
            <h1 className="brand">Admin Control Panel</h1>
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

    setIsSuggestOpen(false);
    navigate(`/products?keyword=${encodeURIComponent(keyword)}`);
  };

  const handleSuggestionClick = (productId) => {
    setIsSuggestOpen(false);
    setSearchKeyword("");
    navigate(`/products/${productId}`);
  };

  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link to="/" className="brand-link" aria-label="Trang chủ Tech Shop">
          <h1 className="brand">Tech Shop</h1>
        </Link>

        <nav className="nav-menu" aria-label="Điều hướng chính">
          <Link to="/">Trang chủ</Link>
          <Link to="/products">Sản phẩm</Link>
          <Link to="/about">Giới thiệu</Link>
          <Link to="/contract">Liên hệ</Link>
        </nav>

        <div className="nav-search-wrap" ref={searchWrapRef}>
          <form className="nav-search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              value={searchKeyword}
              onChange={(event) => {
                setSearchKeyword(event.target.value);
                setIsSuggestOpen(true);
              }}
              onFocus={() => setIsSuggestOpen(true)}
              placeholder="Tìm kiếm sản phẩm"
              aria-label="Tìm kiếm sản phẩm"
            />
            <button type="submit">Tìm</button>
          </form>

          {isSuggestOpen && searchKeyword.trim() ? (
            <div className="nav-search-suggestions" role="listbox">
              {productSuggestions.length === 0 ? (
                <div className="nav-search-empty">Không tìm thấy sản phẩm phù hợp.</div>
              ) : (
                productSuggestions.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    className="nav-search-item"
                    onClick={() => handleSuggestionClick(product._id)}
                  >
                    <span className="nav-search-item-main">
                      <img
                        src={getProductImageSrc(product)}
                        alt={product.name}
                        className="nav-search-item-image"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                      <span className="nav-search-item-name">{product.name}</span>
                    </span>
                    <span className="nav-search-item-price">
                      {Number(product.finalPrice || product.price || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="nav-actions">
          <Link to="/cart" className="icon-action" aria-label="Giỏ hàng">
            <IconCart />
            <span>Giỏ hàng</span>
            {totalItems > 0 ? <span className="cart-count">{totalItems}</span> : null}
          </Link>

          {!auth ? (
            <Link to="/login" className="auth-cta">Đăng nhập</Link>
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
                <span className="account-label">Tài khoản</span>
                <span className="caret">▾</span>
              </button>

              <div className={`account-dropdown-menu ${isAccountMenuOpen ? "open" : ""}`} role="menu">
                <Link to="/profile" className="account-menu-item" role="menuitem">
                  <span className="icon-wrap"><IconProfile /></span>
                  <span>Hồ sơ của tôi</span>
                </Link>
                <Link to="/order-history" className="account-menu-item" role="menuitem">
                  <span className="icon-wrap"><IconOrder /></span>
                  <span>Đơn hàng của tôi</span>
                </Link>
                <div className="account-menu-divider" aria-hidden="true" />
                <button type="button" className="account-menu-item logout-item" role="menuitem" onClick={logout}>
                  <span className="icon-wrap"><IconLogout /></span>
                  <span>Đăng xuất</span>
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
