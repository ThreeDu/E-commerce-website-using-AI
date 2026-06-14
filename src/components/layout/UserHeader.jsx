/**
 * User-facing header with search, navigation, cart, and account menu.
 *
 * Extracted from Header to separate admin and user-facing layouts.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { getProductImageSrc } from "../../utils/productUtils";
import { fetchProducts } from "../../services/productService";
import NotificationBell from "../notification/NotificationBell";

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

function UserHeader() {
  const { auth, logout, isAuthenticated } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();

  const [searchKeyword, setSearchKeyword] = useState("");
  const [productIndex, setProductIndex] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const accountMenuRef = useRef(null);
  const searchWrapRef = useRef(null);

  const totalItems = cart ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;

  // Close menus on outside clicks
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleOutsideSearch = (event) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target)) {
        setIsSuggestOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideSearch);
    return () => document.removeEventListener("mousedown", handleOutsideSearch);
  }, []);

  // Load product index for search suggestions
  useEffect(() => {
    const loadProductIndex = async () => {
      try {
        const data = await fetchProducts();
        setProductIndex(Array.isArray(data) ? data : []);
      } catch (error) {
        // Silent fail to avoid blocking header.
      }
    };

    loadProductIndex();
  }, []);

  // Filter suggestions based on keyword
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
    <header className="sticky top-0 z-[1000] bg-bg-secondary text-text-primary border-b border-border-subtle">
      <div className="w-[min(1100px,92%)] mx-auto min-h-[82px] flex items-center gap-4 justify-between py-3.5 flex-nowrap max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:gap-2.5">
        <Link to="/" className="no-underline" aria-label="Trang chủ Tech Shop">
          <h1 className="m-0 text-[1.45rem] tracking-[0.02em] text-text-primary font-extrabold">Tech Shop</h1>
        </Link>

        <nav className="flex gap-2 items-center min-w-0 max-[720px]:flex-wrap max-[720px]:w-full" aria-label="Điều hướng chính">
          <Link to="/" className="text-text-primary no-underline bg-white border border-border-subtle rounded-full py-2 px-3.5 text-[13px] font-bold transition-all duration-150 hover:-translate-y-px hover:bg-[#e8f5f4]">Trang chủ</Link>
          <Link to="/products" className="text-text-primary no-underline bg-white border border-border-subtle rounded-full py-2 px-3.5 text-[13px] font-bold transition-all duration-150 hover:-translate-y-px hover:bg-[#e8f5f4]">Sản phẩm</Link>
          <Link to="/about" className="text-text-primary no-underline bg-white border border-border-subtle rounded-full py-2 px-3.5 text-[13px] font-bold transition-all duration-150 hover:-translate-y-px hover:bg-[#e8f5f4]">Giới thiệu</Link>
          <Link to="/contract" className="text-text-primary no-underline bg-white border border-border-subtle rounded-full py-2 px-3.5 text-[13px] font-bold transition-all duration-150 hover:-translate-y-px hover:bg-[#e8f5f4]">Liên hệ</Link>
        </nav>

        <div className="relative flex-1 flex items-center min-w-[220px] max-w-[460px] max-[720px]:w-full max-[720px]:max-w-none" ref={searchWrapRef}>
          <form className="flex-1 grid grid-cols-[1fr_auto] items-center min-w-[220px] max-w-[460px] border border-border-subtle rounded-full overflow-hidden bg-white max-[720px]:w-full max-[720px]:max-w-none" onSubmit={handleSearchSubmit}>
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
              className="border-none bg-transparent py-[11px] px-3.5 text-sm text-text-primary focus:outline-none"
            />
            <button type="submit" className="border-none border-l border-l-border-subtle bg-[#eaf5ff] text-text-primary py-[11px] px-[15px] text-[13px] font-extrabold cursor-pointer">Tìm</button>
          </form>

          {isSuggestOpen && searchKeyword.trim() ? (
            <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-border-subtle rounded-2xl shadow-[0_18px_35px_rgba(0,0,0,0.08)] p-1.5 z-[1100]" role="listbox">
              {productSuggestions.length === 0 ? (
                <div className="py-2.5 px-3 text-xs text-[#64748b]">Không tìm thấy sản phẩm phù hợp.</div>
              ) : (
                productSuggestions.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    className="w-full flex items-center justify-between gap-3 border-none bg-transparent py-2.5 px-3 rounded-xl text-left cursor-pointer font-sans text-text-primary hover:bg-[#eef5ff]"
                    onClick={() => handleSuggestionClick(product._id)}
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <img
                        src={getProductImageSrc(product)}
                        alt={product.name}
                        className="w-9 h-9 rounded-[10px] object-cover border border-[rgba(0,0,0,0.08)] bg-[#f1f5f9] shrink-0"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                      <span className="text-[13px] font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{product.name}</span>
                    </span>
                    <span className="text-xs font-bold text-shop-primary whitespace-nowrap">
                      {Number(product.finalPrice || product.price || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 max-[720px]:w-full max-[720px]:justify-start max-[720px]:flex-wrap">
          {isAuthenticated ? (
            <>
              <Link to="/cart" className="relative inline-flex items-center gap-1.5 border border-border-subtle rounded-[20px] bg-white text-text-primary py-2 px-3 no-underline text-[13px] font-bold transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,23,42,0.16)]" aria-label="Giỏ hàng">
                <IconCart />
                <span>Giỏ hàng</span>
                {totalItems > 0 ? <span className="min-w-5 h-5 px-1.5 rounded-full inline-flex items-center justify-center bg-shop-accent-soft text-[#9a3412] text-[11px] font-extrabold border border-border-subtle">{totalItems}</span> : null}
              </Link>
              <NotificationBell />
            </>
          ) : null}

          {!auth ? (
            <Link to="/login" className="inline-flex items-center justify-center rounded-[20px] border border-border-subtle bg-white text-text-primary no-underline py-2 px-3.5 text-[13px] font-extrabold transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(15,23,42,0.16)]">Đăng nhập</Link>
          ) : (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-text-primary bg-white border border-border-subtle rounded-[20px] py-2 px-3 cursor-pointer font-sans text-[13px] font-bold hover:bg-[#e8f5f4] transition-all duration-150"
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              >
                {auth?.user?.avatar ? (
                  <img
                    src={auth.user.avatar}
                    alt={auth.user.name || "Avatar"}
                    className="w-[18px] h-[18px] rounded-full object-cover border border-border-subtle block"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/placeholder-avatar.svg";
                    }}
                  />
                ) : (
                  <span className="relative w-[18px] h-[18px] inline-flex items-center justify-center" aria-hidden="true">
                    <span className="absolute rounded-full w-4 h-4 border border-border-subtle bg-[#ffd9cb] -translate-x-0.5 -translate-y-px" />
                    <span className="absolute rounded-full w-4 h-4 border border-border-subtle bg-[#dff5f2] translate-x-px translate-y-px" />
                    <span className="absolute rounded-full w-4 h-4 border border-border-subtle bg-white inline-flex items-center justify-center text-text-primary text-[10px] font-extrabold">{String(auth?.user?.name || "T").slice(0, 1).toUpperCase()}</span>
                  </span>
                )}
                <span className="font-bold text-text-primary">Tài khoản</span>
                <span className={`transition-transform duration-[220ms] text-text-primary ${isAccountMenuOpen ? "rotate-180" : ""}`}>▾</span>
              </button>

              <div className={`absolute top-[calc(100%+6px)] right-0 min-w-[220px] bg-white border border-border-subtle rounded-[20px] shadow-admin p-1.5 z-[1200] transition-all duration-[220ms] ease-in-out max-[720px]:right-auto max-[720px]:left-0 max-[720px]:min-w-[200px] ${isAccountMenuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`} role="menu">
                <Link to="/profile" className="w-full flex items-center gap-2 no-underline text-gray-800 border-none bg-transparent py-2 px-2.5 rounded-lg cursor-pointer text-left text-[13px] font-semibold leading-[1.35] font-sans hover:bg-[#eef6ff]" role="menuitem">
                  <span className="inline-flex items-center justify-center [&_svg]:w-3.5 [&_svg]:h-3.5"><IconProfile /></span>
                  <span>Hồ sơ của tôi</span>
                </Link>
                <Link to="/order-history" className="w-full flex items-center gap-2 no-underline text-gray-800 border-none bg-transparent py-2 px-2.5 rounded-lg cursor-pointer text-left text-[13px] font-semibold leading-[1.35] font-sans hover:bg-[#eef6ff]" role="menuitem">
                  <span className="inline-flex items-center justify-center [&_svg]:w-3.5 [&_svg]:h-3.5"><IconOrder /></span>
                  <span>Đơn hàng của tôi</span>
                </Link>
                <div className="h-px mx-1 my-[5px] bg-[#d5e0ec]" aria-hidden="true" />
                <button type="button" className="w-full flex items-center gap-2 no-underline text-red-700 border-none bg-transparent py-2 px-2.5 rounded-lg cursor-pointer text-left text-[13px] font-semibold leading-[1.35] font-sans hover:bg-[#eef6ff]" role="menuitem" onClick={logout}>
                  <span className="inline-flex items-center justify-center [&_svg]:w-3.5 [&_svg]:h-3.5"><IconLogout /></span>
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

export default UserHeader;
