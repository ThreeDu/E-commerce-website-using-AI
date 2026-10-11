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
    <header className="sticky top-0 z-[1000] bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)] transition-all">
      <div className="w-[min(1140px,92%)] mx-auto min-h-[72px] flex items-center gap-5 justify-between py-3 flex-nowrap max-[880px]:grid max-[880px]:grid-cols-1 max-[880px]:gap-3 max-[880px]:py-3">
        {/* Brand Logo & Main Nav */}
        <div className="flex items-center gap-7">
          <Link to="/" className="no-underline flex items-center gap-2 shrink-0" aria-label="Trang chủ Tech Shop">
            <span className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black text-sm shadow-sm">
              T
            </span>
            <span className="text-[1.3rem] tracking-tight text-slate-900 font-black">
              TechShop<span className="text-teal-600 font-black">.ai</span>
            </span>
          </Link>

          <nav className="flex gap-1.5 items-center max-[880px]:flex-wrap" aria-label="Điều hướng chính">
            <Link to="/" className="text-slate-600 hover:text-slate-950 px-3 py-1.5 rounded-lg text-sm font-semibold no-underline transition-colors hover:bg-slate-100/70">
              Trang chủ
            </Link>
            <Link to="/products" className="text-slate-600 hover:text-slate-950 px-3 py-1.5 rounded-lg text-sm font-semibold no-underline transition-colors hover:bg-slate-100/70">
              Sản phẩm
            </Link>
            <Link to="/about" className="text-slate-600 hover:text-slate-950 px-3 py-1.5 rounded-lg text-sm font-semibold no-underline transition-colors hover:bg-slate-100/70">
              Giới thiệu
            </Link>
            <Link to="/contract" className="text-slate-600 hover:text-slate-950 px-3 py-1.5 rounded-lg text-sm font-semibold no-underline transition-colors hover:bg-slate-100/70">
              Liên hệ
            </Link>
          </nav>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 flex items-center min-w-[200px] max-w-[420px] max-[880px]:w-full max-[880px]:max-w-none" ref={searchWrapRef}>
          <form className="w-full flex items-center border border-slate-200 rounded-full overflow-hidden bg-slate-50/80 transition-all focus-within:border-teal-600 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.12)]" onSubmit={handleSearchSubmit}>
            <div className="pl-3.5 pr-1.5 text-slate-400 flex items-center">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="search"
              value={searchKeyword}
              onChange={(event) => {
                setSearchKeyword(event.target.value);
                setIsSuggestOpen(true);
              }}
              onFocus={() => setIsSuggestOpen(true)}
              placeholder="Tìm iPhone, Laptop, linh kiện..."
              aria-label="Tìm kiếm sản phẩm"
              className="w-full border-none bg-transparent py-2 px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button type="submit" className="border-none bg-teal-700 hover:bg-teal-800 text-white py-1.5 px-3.5 m-1 rounded-full text-xs font-bold cursor-pointer transition-colors shadow-xs">
              Tìm
            </button>
          </form>

          {isSuggestOpen && searchKeyword.trim() ? (
            <div className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-[0_18px_35px_rgba(15,23,42,0.1)] p-1.5 z-[1100]" role="listbox">
              {productSuggestions.length === 0 ? (
                <div className="py-2.5 px-3 text-xs text-slate-500">Không tìm thấy sản phẩm phù hợp.</div>
              ) : (
                productSuggestions.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    className="w-full flex items-center justify-between gap-3 border-none bg-transparent py-2 px-2.5 rounded-xl text-left cursor-pointer font-sans text-slate-800 hover:bg-slate-50 transition-colors"
                    onClick={() => handleSuggestionClick(product._id)}
                  >
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <img
                        src={getProductImageSrc(product)}
                        alt={product.name}
                        className="w-9 h-9 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                      <span className="text-xs font-bold text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{product.name}</span>
                    </span>
                    <span className="text-xs font-bold text-teal-700 whitespace-nowrap">
                      {Number(product.finalPrice || product.price || 0).toLocaleString("vi-VN")} đ
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>

        {/* User Actions (Cart, Notifications, Account) */}
        <div className="flex items-center gap-2.5 max-[880px]:w-full max-[880px]:justify-end">
          {isAuthenticated ? (
            <>
              <Link to="/cart" className="relative inline-flex items-center gap-2 border border-slate-200/80 rounded-full bg-white hover:bg-slate-50 text-slate-700 py-1.5 px-3.5 no-underline text-xs font-bold transition-all shadow-xs" aria-label="Giỏ hàng">
                <IconCart />
                <span className="hidden sm:inline">Giỏ hàng</span>
                {totalItems > 0 ? (
                  <span className="min-w-5 h-5 px-1.5 rounded-full inline-flex items-center justify-center bg-teal-700 text-white text-[10px] font-black">
                    {totalItems}
                  </span>
                ) : null}
              </Link>
              <NotificationBell />
            </>
          ) : null}

          {!auth ? (
            <Link to="/login" className="inline-flex items-center justify-center rounded-full bg-teal-700 hover:bg-teal-800 text-white no-underline py-2 px-4.5 text-xs font-bold transition-all shadow-xs">
              Đăng nhập
            </Link>
          ) : (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full py-1.5 px-3 cursor-pointer font-sans text-xs font-bold transition-all shadow-xs"
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              >
                {auth?.user?.avatar ? (
                  <img
                    src={auth.user.avatar}
                    alt={auth.user.name || "Avatar"}
                    className="w-5 h-5 rounded-full object-cover border border-slate-200 block"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/placeholder-avatar.svg";
                    }}
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 inline-flex items-center justify-center text-[11px] font-bold">
                    {String(auth?.user?.name || "T").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold text-slate-800 max-w-[100px] truncate">{auth?.user?.name || "Tài khoản"}</span>
                <span className={`text-[10px] text-slate-400 transition-transform duration-200 ${isAccountMenuOpen ? "rotate-180" : ""}`}>▾</span>
              </button>

              <div className={`absolute top-[calc(100%+6px)] right-0 min-w-[210px] bg-white border border-slate-200 rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.12)] p-1.5 z-[1200] transition-all duration-200 ease-in-out ${isAccountMenuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`} role="menu">
                <Link to="/profile" className="w-full flex items-center gap-2.5 no-underline text-slate-700 hover:text-slate-900 border-none bg-transparent py-2 px-3 rounded-xl cursor-pointer text-xs font-semibold hover:bg-slate-50 transition-colors" role="menuitem">
                  <span className="text-slate-400"><IconProfile /></span>
                  <span>Hồ sơ cá nhân</span>
                </Link>
                <Link to="/order-history" className="w-full flex items-center gap-2.5 no-underline text-slate-700 hover:text-slate-900 border-none bg-transparent py-2 px-3 rounded-xl cursor-pointer text-xs font-semibold hover:bg-slate-50 transition-colors" role="menuitem">
                  <span className="text-slate-400"><IconOrder /></span>
                  <span>Lịch sử đơn hàng</span>
                </Link>
                <div className="h-px mx-1.5 my-1 bg-slate-100" aria-hidden="true" />
                <button type="button" className="w-full flex items-center gap-2.5 no-underline text-rose-600 hover:text-rose-700 border-none bg-transparent py-2 px-3 rounded-xl cursor-pointer text-xs font-semibold hover:bg-rose-50 transition-colors" role="menuitem" onClick={logout}>
                  <span className="text-rose-500"><IconLogout /></span>
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
