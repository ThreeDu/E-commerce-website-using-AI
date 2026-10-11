import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getProductImageSrc, getProductPricing, isOutOfStock } from "../utils/productUtils";
import { fetchProducts } from "../services/productService";
import { fetchCategories } from "../services/categoryService";
import { fetchRecommendations } from "../services/recommendationService";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { fetchWishlist, addToWishlist, removeFromWishlist } from "../services/wishlistService";

const CAT_COLORS = [
  "bg-[#e9f6ff]",
  "bg-[#fef2e4]",
  "bg-[#edf9f0]",
  "bg-[#f6f0ff]",
  "bg-[#fff4f4]",
];

function HomePage() {
  const { addToCart, cart } = useCart();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [recommendReady, setRecommendReady] = useState(false);
  const { success, error: notifyError, warning } = useNotification();
  const [wishlistIds, setWishlistIds] = useState([]);
  const [pendingWishlistIds, setPendingWishlistIds] = useState([]);

  // Load wishlist
  useEffect(() => {
    const loadWishlist = async () => {
      if (!auth?.token) {
        setWishlistIds([]);
        return;
      }

      try {
        const data = await fetchWishlist(auth.token);
        const ids = Array.isArray(data?.wishlist)
          ? data.wishlist.map((item) => String(item._id))
          : [];
        setWishlistIds(ids);
      } catch (error) {
        setWishlistIds([]);
      }
    };

    loadWishlist();
  }, [auth?.token]);

  const handleAddToCart = (product) => {
    if (!auth?.token) {
      navigate("/login", { state: { from: "/" } });
      return;
    }

    addToCart({ ...product, id: product._id });
    success(`Đã thêm ${product.name} vào giỏ hàng!`, {
      title: "Giỏ hàng",
      duration: 3000,
    });

    trackEvent({
      eventName: "add_to_cart",
      token: auth?.token,
      metadata: {
        productId: String(product._id),
        productName: String(product.name || ""),
        category: String(product.category || ""),
        quantity: 1,
        price: Number(product.finalPrice || product.price || 0),
      },
    });
  };

  const handleToggleWishlist = async (productId, productName) => {
    if (!auth?.token) {
      warning("Vui lòng đăng nhập để sử dụng danh sách yêu thích.", { title: "Yêu thích" });
      navigate("/login", { state: { from: "/" } });
      return;
    }

    if (pendingWishlistIds.includes(productId)) {
      return;
    }

    const isWishlisted = wishlistIds.includes(productId);
    setPendingWishlistIds((prev) => [...prev, productId]);

    try {
      const data = isWishlisted
        ? await removeFromWishlist(productId, auth.token)
        : await addToWishlist(productId, auth.token);

      const ids = Array.isArray(data?.wishlist)
        ? data.wishlist.map((item) => String(item._id))
        : [];
      setWishlistIds(ids);

      const isNowWishlisted = ids.includes(String(productId));
      success(
        isNowWishlisted
          ? `Đã thêm ${productName} vào danh sách yêu thích.`
          : `Đã xóa ${productName} khỏi danh sách yêu thích.`,
        { title: "Yêu thích" }
      );

      trackEvent({
        eventName: isNowWishlisted ? "wishlist_add" : "wishlist_remove",
        token: auth?.token,
        metadata: {
          productId: String(productId),
          productName: String(productName),
        },
      });
    } catch (error) {
      console.error("Lỗi cập nhật wishlist:", error);
      notifyError(error?.message || "Không thể kết nối đến máy chủ.", { title: "Yêu thích" });
    } finally {
      setPendingWishlistIds((prev) => prev.filter((id) => id !== productId));
    }
  };

  const level2Categories = useMemo(() => {
    if (!Array.isArray(categories) || categories.length === 0) {
      return [];
    }

    const categoriesById = new Map(
      categories.map((item) => [String(item._id), item])
    );

    const level2 = categories.filter((item) => {
      if (!item?.parentId) {
        return false;
      }

      const parent = categoriesById.get(String(item.parentId));
      return Boolean(parent && !parent.parentId);
    });

    // Fisher-Yates shuffle for unbiased random pick.
    const randomized = [...level2];
    for (let i = randomized.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
    }

    return randomized.slice(0, 4);
  }, [categories]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchProducts();
        const rankedProducts = [...data].sort((left, right) => {
            const leftPurchases = Number(left?.totalPurchases || 0);
            const rightPurchases = Number(right?.totalPurchases || 0);
            if (rightPurchases !== leftPurchases) {
              return rightPurchases - leftPurchases;
            }

            const leftViews = Number(left?.totalViews || 0);
            const rightViews = Number(right?.totalViews || 0);
            if (rightViews !== leftViews) {
              return rightViews - leftViews;
            }

            const leftRating = Number(left?.averageRating || 0);
            const rightRating = Number(right?.averageRating || 0);
            if (rightRating !== leftRating) {
              return rightRating - leftRating;
            }

            const leftRatings = Number(left?.totalRatings || 0);
            const rightRatings = Number(right?.totalRatings || 0);
            return rightRatings - leftRatings;
          });

          setFeaturedProducts(rankedProducts.slice(0, 4));

        const catData = await fetchCategories();
        setCategories(catData);
      } catch (error) {
        console.error("Lỗi tải dữ liệu trang chủ:", error);
      }
    };
    fetchData();
  }, []);

  // Derive stable cart product IDs for recommendation API
  const cartProductIds = useMemo(
    () => cart.map((item) => String(item.id || item._id || "")).filter(Boolean),
    [cart]
  );

  // Fetch personalized recommendations
  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const data = await fetchRecommendations({
          token: auth?.token,
          limit: 8,
          cartProductIds,
        });
        setRecommendedProducts(Array.isArray(data?.products) ? data.products : []);
      } catch (error) {
        console.error("Lỗi tải gợi ý sản phẩm:", error);
        setRecommendedProducts([]);
      } finally {
        setRecommendReady(true);
      }
    };
    loadRecommendations();
  }, [auth?.token, cartProductIds]);

  const handleCategoryClick = (category) => {
    navigate("/products", {
      state: {
        categoryId: String(category._id),
        category: category.name,
      },
    });
  };


  return (
    <main className="w-[min(1140px,92%)] mx-auto flex-1 py-7 text-slate-800">
      {/* ── 1. Hero Section: Bento Grid Macrostructure ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
        {/* Main Hero Card (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-10 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200/60 mb-5">
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
              <span>Hệ thống bán lẻ thiết bị công nghệ chính hãng</span>
            </div>
            <h1 className="m-0 text-[clamp(1.9rem,3.2vw,2.9rem)] font-black leading-[1.1] tracking-tight text-slate-900">
              Công nghệ đỉnh cao. <br />
              <span className="text-teal-700">Trải nghiệm thông minh.</span>
            </h1>
            <p className="mt-4 mb-0 max-w-[580px] text-sm sm:text-base leading-relaxed text-slate-600">
              Khám phá các dòng smartphone, máy tính xách tay và phụ kiện mới nhất. So sánh thông số thực tế và nhận tư vấn cấu hình chính xác cùng trợ lý AI 24/7.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-3 items-center flex-wrap">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold no-underline transition-all shadow-xs hover:-translate-y-0.5"
              >
                <span>Khám phá sản phẩm</span>
                <span>→</span>
              </Link>
              <a
                href="#recommendations"
                className="inline-flex items-center justify-center min-h-[46px] px-5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-bold no-underline transition-all"
              >
                Gợi ý cho bạn
              </a>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span>✓ Bảo hành 12T</span>
              <span>✓ Đổi trả 30 ngày</span>
              <span>✓ Giao hỏa tốc 2h</span>
            </div>
          </div>
        </div>

        {/* Right Bento Column (4 cols) */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
          {/* Bento Tile 1: AI Assistant Feature Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 border border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg">
                  🤖
                </span>
                <span className="text-[10px] uppercase font-black tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full">
                  AI Powered
                </span>
              </div>
              <h3 className="m-0 text-base font-bold text-white">Trợ lý công nghệ AI</h3>
              <p className="mt-2 mb-0 text-xs text-slate-300 leading-relaxed">
                Nhận diện thiết bị qua hình ảnh, tư vấn chọn máy theo ngân sách và so sánh chi tiết thông số kỹ thuật.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/10 text-xs text-teal-300 font-semibold flex items-center justify-between">
              <span>Mở khung chat ở góc phải</span>
              <span>💬</span>
            </div>
          </div>

          {/* Bento Tile 2: Danh mục mua sắm hot */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="m-0 text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Truy cập nhanh</h3>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <Link to="/products" className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-800 border border-slate-100 text-slate-700 no-underline transition-colors flex items-center gap-2">
                  <span>📱</span>
                  <span>Điện thoại</span>
                </Link>
                <Link to="/products" className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-800 border border-slate-100 text-slate-700 no-underline transition-colors flex items-center gap-2">
                  <span>💻</span>
                  <span>Laptop</span>
                </Link>
                <Link to="/products" className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-800 border border-slate-100 text-slate-700 no-underline transition-colors flex items-center gap-2">
                  <span>🎧</span>
                  <span>Tai nghe</span>
                </Link>
                <Link to="/products" className="p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-800 border border-slate-100 text-slate-700 no-underline transition-colors flex items-center gap-2">
                  <span>⌚</span>
                  <span>Phụ kiện</span>
                </Link>
              </div>
            </div>
            <p className="m-0 mt-4 text-[11px] text-slate-400">Cam kết 100% hàng chính hãng full box</p>
          </div>
        </div>
      </section>

      {/* ── 2. Gợi ý cá nhân hóa (AI Recommendations) ── */}
      {recommendReady && recommendedProducts.length > 0 && (
        <section
          id="recommendations"
          className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-8"
        >
          <div className="flex justify-between items-end gap-3 mb-6 pb-4 border-b border-slate-100 max-[680px]:flex-col max-[680px]:items-start">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 mb-1">
                <span>✨</span>
                <span>Cá nhân hóa theo hành vi</span>
              </div>
              <h2 className="m-0 text-xl font-extrabold text-slate-900 tracking-tight">Gợi ý dành riêng cho bạn</h2>
              <p className="m-0 mt-1 text-xs text-slate-500">Được tối ưu theo lịch sử tìm kiếm và các dòng sản phẩm bạn quan tâm</p>
            </div>
            <Link to="/products" className="text-xs font-bold text-teal-700 hover:text-teal-800 no-underline flex items-center gap-1 shrink-0">
              <span>Xem tất cả</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid gap-4 grid-cols-4 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1">
            {recommendedProducts.map((product) => {
              const pricing = getProductPricing(product);
              const outOfStock = isOutOfStock(product);
              const isWishlisted = wishlistIds.includes(String(product._id));
              const isPendingWish = pendingWishlistIds.includes(String(product._id));

              return (
                <article
                  key={product._id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-3 flex flex-col h-full transition-all duration-200 hover:border-teal-500 hover:shadow-md group"
                >
                  <div className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-3 aspect-square flex items-center justify-center">
                    {pricing.hasDiscount ? (
                      <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black tracking-wide shadow-xs">
                        -{pricing.discountPercent}%
                      </span>
                    ) : null}

                    {outOfStock ? (
                      <span className="absolute left-2 right-2 bottom-2 z-10 py-1 rounded-md bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold text-center">
                        Tạm hết hàng
                      </span>
                    ) : null}

                    <button
                      type="button"
                      aria-label={isWishlisted ? "Bỏ yêu thích" : "Thêm yêu thích"}
                      disabled={isPendingWish}
                      onClick={() => handleToggleWishlist(product._id, product.name)}
                      className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border cursor-pointer transition-transform active:scale-90 ${
                        isWishlisted
                          ? "bg-rose-50 border-rose-200 text-rose-600"
                          : "bg-white/90 border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-white"
                      }`}
                    >
                      <span className="text-xs">{isWishlisted ? "❤️" : "🤍"}</span>
                    </button>

                    <Link to={`/products/${product._id}`} className="w-full h-full flex items-center justify-center">
                      <img
                        src={getProductImageSrc(product)}
                        alt={product.name}
                        className={`max-w-full max-h-full object-contain p-2 transition-transform duration-200 group-hover:scale-105 ${
                          outOfStock ? "grayscale-[40%] opacity-70" : ""
                        }`}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                    </Link>
                  </div>

                  <Link to={`/products/${product._id}`} className="no-underline flex-1 flex flex-col">
                    <h3 className="m-0 text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-teal-700 transition-colors">
                      {product.name}
                    </h3>

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                      <span className="text-amber-500 font-bold">★ {Number(product.averageRating || 0).toFixed(1)}</span>
                      <span>•</span>
                      <span>{Number(product.totalPurchases || 0)} đã mua</span>
                    </div>

                    <div className="mt-2.5">
                      <div className="text-sm font-extrabold text-slate-900">
                        {pricing.finalPrice.toLocaleString("vi-VN")} đ
                      </div>
                      {pricing.hasDiscount ? (
                        <div className="text-[11px] text-slate-400 line-through">
                          {pricing.basePrice.toLocaleString("vi-VN")} đ
                        </div>
                      ) : null}
                    </div>
                  </Link>

                  <button
                    type="button"
                    disabled={outOfStock}
                    onClick={() => handleAddToCart(product)}
                    className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      outOfStock
                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-teal-700 hover:bg-teal-800 border-teal-700 text-white shadow-xs active:scale-[0.98]"
                    }`}
                  >
                    {outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 3. Khám phá theo danh mục ── */}
      <section id="categories" className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex justify-between items-center gap-2.5 mb-5 pb-4 border-b border-slate-100 max-[680px]:flex-col max-[680px]:items-start">
          <div>
            <h2 className="m-0 text-xl font-extrabold text-slate-900 tracking-tight">Danh mục sản phẩm</h2>
            <p className="m-0 mt-1 text-xs text-slate-500">Phân loại theo nhu cầu sử dụng và phân khúc giá</p>
          </div>
          <Link to="/products" className="text-xs font-bold text-teal-700 hover:text-teal-800 no-underline">
            Tất cả danh mục →
          </Link>
        </div>

        <div className="grid gap-3.5 grid-cols-4 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1">
          {level2Categories.map((category) => (
            <button
              type="button"
              key={category._id}
              onClick={() => handleCategoryClick(category)}
              className="border border-slate-200/80 rounded-2xl bg-slate-50/60 hover:bg-white hover:border-teal-500 hover:shadow-sm min-h-[96px] text-left p-4 cursor-pointer transition-all duration-150 flex flex-col justify-between"
            >
              <span className="text-[10px] tracking-wider uppercase font-bold text-teal-700">Khám phá</span>
              <strong className="block text-sm font-bold text-slate-900 leading-snug">{category.name}</strong>
              <span className="text-[11px] text-slate-400 font-medium">Xem ngay →</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── 4. Sản phẩm bán chạy nhất (Featured Products) ── */}
      <section className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex justify-between items-center gap-2.5 mb-5 pb-4 border-b border-slate-100 max-[680px]:flex-col max-[680px]:items-start">
          <div>
            <h2 className="m-0 text-xl font-extrabold text-slate-900 tracking-tight">Sản phẩm nổi bật</h2>
            <p className="m-0 mt-1 text-xs text-slate-500">Thiết bị bán chạy và được đánh giá cao nhất trong tháng</p>
          </div>
          <Link to="/products" className="text-xs font-bold text-teal-700 hover:text-teal-800 no-underline">
            Xem trọn bộ sưu tập →
          </Link>
        </div>

        <div className="grid gap-4 grid-cols-4 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1">
          {featuredProducts.map((product) => {
            const pricing = getProductPricing(product);
            const outOfStock = isOutOfStock(product);
            const isWishlisted = wishlistIds.includes(String(product._id));
            const isPendingWish = pendingWishlistIds.includes(String(product._id));

            return (
              <article
                key={product._id}
                className="bg-white border border-slate-200/80 rounded-2xl p-3 flex flex-col h-full transition-all duration-200 hover:border-teal-500 hover:shadow-md group"
              >
                <div className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-3 aspect-square flex items-center justify-center">
                  {pricing.hasDiscount ? (
                    <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black tracking-wide shadow-xs">
                      -{pricing.discountPercent}%
                    </span>
                  ) : null}

                  {outOfStock ? (
                    <span className="absolute left-2 right-2 bottom-2 z-10 py-1 rounded-md bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold text-center">
                      Tạm hết hàng
                    </span>
                  ) : null}

                  <button
                    type="button"
                    aria-label={isWishlisted ? "Bỏ yêu thích" : "Thêm yêu thích"}
                    disabled={isPendingWish}
                    onClick={() => handleToggleWishlist(product._id, product.name)}
                    className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border cursor-pointer transition-transform active:scale-90 ${
                      isWishlisted
                        ? "bg-rose-50 border-rose-200 text-rose-600"
                        : "bg-white/90 border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-white"
                    }`}
                  >
                    <span className="text-xs">{isWishlisted ? "❤️" : "🤍"}</span>
                  </button>

                  <Link to={`/products/${product._id}`} className="w-full h-full flex items-center justify-center">
                    <img
                      src={getProductImageSrc(product)}
                      alt={product.name}
                      className={`max-w-full max-h-full object-contain p-2 transition-transform duration-200 group-hover:scale-105 ${
                        outOfStock ? "grayscale-[40%] opacity-70" : ""
                      }`}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  </Link>
                </div>

                <Link to={`/products/${product._id}`} className="no-underline flex-1 flex flex-col">
                  <h3 className="m-0 text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-teal-700 transition-colors">
                    {product.name}
                  </h3>

                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                    <span className="text-amber-500 font-bold">★ {Number(product.averageRating || 0).toFixed(1)}</span>
                    <span>•</span>
                    <span>{Number(product.totalPurchases || 0)} đã mua</span>
                  </div>

                  <div className="mt-2.5">
                    <div className="text-sm font-extrabold text-slate-900">
                      {pricing.finalPrice.toLocaleString("vi-VN")} đ
                    </div>
                    {pricing.hasDiscount ? (
                      <div className="text-[11px] text-slate-400 line-through">
                        {pricing.basePrice.toLocaleString("vi-VN")} đ
                      </div>
                    ) : null}
                  </div>
                </Link>

                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => handleAddToCart(product)}
                  className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                    outOfStock
                      ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-teal-700 hover:bg-teal-800 border-teal-700 text-white shadow-xs active:scale-[0.98]"
                  }`}
                >
                  {outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default HomePage;