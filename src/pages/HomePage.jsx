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
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 py-3 px-5 text-text-primary max-[680px]:py-2 max-[680px]:px-2.5">
      <section className="grid grid-cols-1 gap-4 mb-[22px]">
        <div className="border border-text-primary rounded-[22px] bg-white p-[26px]">
          <p className="m-0 mb-2.5 text-xs font-extrabold tracking-[0.08em] uppercase text-shop-primary">Thương mại ưu tiên công nghệ</p>
          <h2 className="m-0 text-[clamp(1.7rem,3vw,2.7rem)] leading-[1.05] tracking-[-0.02em]">Trải nghiệm nổi bật.</h2>
          <p className="mt-3.5 mb-0 max-w-[640px] leading-relaxed text-[#2d3748]">
            Tech Shop mang tinh thần Neo-Brutalism: đường nét rõ ràng, độ tương phản cao và trải nghiệm mua sắm gọn, nhanh, chính xác.
          </p>
          <div className="mt-[18px] flex gap-2.5 flex-wrap">
            <Link to="/products" className="min-h-[46px] px-[18px] inline-flex items-center justify-center rounded-[14px] border border-text-primary text-sm font-extrabold no-underline cursor-pointer transition-all duration-[180ms] hover:-translate-y-px bg-[#0f314f] text-white hover:bg-[#174f7c]">Mua ngay</Link>
            <Link to="/about" className="min-h-[46px] px-[18px] inline-flex items-center justify-center rounded-[14px] border border-text-primary text-sm font-extrabold no-underline cursor-pointer transition-all duration-[180ms] hover:-translate-y-px bg-white text-text-primary hover:bg-[#ecf8f6]">Khám phá thêm</Link>
          </div>
        </div>
      </section>

      {/* ── Gợi ý sản phẩm cá nhân hóa ── */}
      {recommendReady && recommendedProducts.length > 0 && (
        <section
          className="border border-[rgba(99,102,241,0.12)] rounded-[22px] bg-white p-4 mb-[18px] bg-[linear-gradient(135deg,#f0f7ff_0%,#fef6f0_40%,#f5f0ff_100%)] relative overflow-hidden"
          id="recommendations"
        >
          <div className="flex justify-between items-center gap-2.5 mb-3.5 max-[680px]:flex-col max-[680px]:items-start">
            <h3 className="m-0 text-[1.35rem] flex items-center gap-1.5">
              <span className="text-[1.2em] animate-[neo-sparkle_2s_ease-in-out_infinite]" aria-hidden="true">✨</span>
              <span>Gợi ý cho bạn</span>
              <span className="inline-flex items-center justify-center h-[18px] px-1.5 rounded-full text-[10px] font-black tracking-[0.08em] uppercase bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white border border-[rgba(99,102,241,0.3)] shadow-[0_2px_8px_rgba(99,102,241,0.25),inset_0_1px_0_rgba(255,255,255,0.2)] animate-[neo-badge-glow_3s_ease-in-out_infinite] leading-none">AI</span>
            </h3>
            <Link to="/products" className="text-[#0f314f] font-extrabold no-underline">Xem tất cả</Link>
          </div>
          <div className="grid gap-3 grid-cols-4 max-[1024px]:grid-cols-2 max-[680px]:grid-cols-1 relative z-[1]">
            {recommendedProducts.map((product, index) => {
              const pricing = getProductPricing(product);
              const outOfStock = isOutOfStock(product);

              return (
                <article
                  className="bg-shop-surface border border-shop-line rounded-shop-md shadow-shop p-3.5 flex flex-col h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)] hover:border-[rgba(99,102,241,0.18)] hover:shadow-[0_14px_35px_rgba(15,23,42,0.08),0_0_0_1px_rgba(99,102,241,0.06)] animate-[neo-card-reveal_0.5s_ease_both]"
                  key={product._id}
                  style={{ animationDelay: `${index * 0.06}s` }}
                >
                  <Link to={`/products/${product._id}`} style={{ textDecoration: "none" }}>
                    <div className="relative rounded-[16px] overflow-hidden border border-shop-line bg-gradient-to-br from-[#f3f8ff] to-[#fdf6f1] mb-3">
                      {pricing.hasDiscount ? <span className="absolute top-2 left-2 z-10 inline-flex items-center justify-center min-h-[24px] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ef4444] text-white border border-[#dc2626]">-{pricing.discountPercent}%</span> : null}
                      {outOfStock ? <span className="absolute left-2 right-2 bottom-2 z-10 inline-flex items-center justify-center min-h-[24px] px-2 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ef4444] text-white border border-[#dc2626]">Hết hàng</span> : null}
                      <img
                        src={getProductImageSrc(product)}
                        alt={product.name}
                        className={`w-full h-[212px] object-cover block ${outOfStock ? "grayscale-[55%] brightness-[88%]" : ""}`}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                    </div>
                    <h3 className="m-0 text-[17px] text-shop-ink font-bold">{product.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#fff5d9] text-[#92400e]">
                        {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)})
                      </span>
                      <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#e6f7ff] text-[#075985]">{Number(product.totalViews || 0)} lượt xem</span>
                      <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#ebfbe8] text-[#166534]">{Number(product.totalPurchases || 0)} lượt mua</span>
                    </div>
                    <p className="my-3 text-[#be2f00] text-[21px] font-extrabold">{pricing.finalPrice.toLocaleString("vi-VN")} đ</p>
                    {pricing.hasDiscount ? (
                      <p className="-mt-1.5 mb-2.5 text-[#94a3b8] text-sm line-through font-bold">{pricing.basePrice.toLocaleString("vi-VN")} đ</p>
                    ) : null}
                  </Link>
                  <div className="mt-auto grid gap-2 pt-3">
                    <button
                      type="button"
                      disabled={pendingWishlistIds.includes(product._id)}
                      className={wishlistIds.includes(product._id)
                        ? "rounded-[14px] border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-70"
                        : "rounded-[14px] border border-[#fdba74] bg-[#fff7ed] text-[#c2410c] px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-[#ffedd5] disabled:cursor-not-allowed disabled:opacity-70"
                      }
                      onClick={() => handleToggleWishlist(product._id, product.name)}
                    >
                      {pendingWishlistIds.includes(product._id)
                        ? "Đang xử lý..."
                        : wishlistIds.includes(product._id)
                        ? "Đã yêu thích"
                        : "Thêm yêu thích"}
                    </button>
                    <button
                      type="button"
                      className={outOfStock
                        ? "rounded-[14px] border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] px-3 py-2.5 text-sm font-bold cursor-not-allowed opacity-100"
                        : "rounded-[14px] border border-[#0f766e] bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:from-[#159287] hover:to-[#0f766e] disabled:cursor-not-allowed disabled:opacity-70"
                      }
                      disabled={outOfStock}
                      onClick={() => handleAddToCart(product)}
                    >
                      {outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section id="about" className="border border-text-primary rounded-[22px] bg-white p-4 mb-[18px]">
        <div className="flex justify-between items-center gap-2.5 mb-3.5 max-[680px]:flex-col max-[680px]:items-start">
          <h3 className="m-0 text-[1.35rem]">Khám phá theo danh mục</h3>
          <Link to="/products" className="text-[#0f314f] font-extrabold no-underline">Xem tất cả sản phẩm</Link>
        </div>
        <div className="grid gap-3 grid-cols-4 max-[1024px]:grid-cols-2 max-[680px]:grid-cols-1">
          {level2Categories.map((category, index) => (
            <button
              type="button"
              key={category._id}
              onClick={() => handleCategoryClick(category)}
              className={`border border-text-primary rounded-[22px] bg-white min-h-[116px] text-left p-3.5 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 ${CAT_COLORS[index % 5]}`}
            >
              <span className="inline-flex text-[11px] tracking-[0.07em] uppercase font-extrabold text-[#334155] mb-3">Dòng sản phẩm</span>
              <strong className="block text-[1.05rem] leading-[1.2]">{category.name}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="border border-text-primary rounded-[22px] bg-white p-4 mb-[18px]">
        <div className="flex justify-between items-center gap-2.5 mb-3.5 max-[680px]:flex-col max-[680px]:items-start">
          <h3 className="m-0 text-[1.35rem]">Sản phẩm nổi bật</h3>
          <Link to="/products" className="text-[#0f314f] font-extrabold no-underline">Mua theo bộ sưu tập</Link>
        </div>
        <div className="grid gap-3 grid-cols-4 max-[1024px]:grid-cols-2 max-[680px]:grid-cols-1">
          {featuredProducts.map((product) => {
            const pricing = getProductPricing(product);
            const outOfStock = isOutOfStock(product);

            return (
            <article className="bg-shop-surface border border-shop-line rounded-shop-md shadow-shop p-3.5 flex flex-col h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(15,23,42,0.08)] animate-shopx-fade-up" key={product._id}>
              <Link to={`/products/${product._id}`} style={{ textDecoration: "none" }}>
                <div className="relative rounded-[16px] overflow-hidden border border-shop-line bg-gradient-to-br from-[#f3f8ff] to-[#fdf6f1] mb-3">
                  {pricing.hasDiscount ? <span className="absolute top-2 left-2 z-10 inline-flex items-center justify-center min-h-[24px] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ef4444] text-white border border-[#dc2626]">-{pricing.discountPercent}%</span> : null}
                  {outOfStock ? <span className="absolute left-2 right-2 bottom-2 z-10 inline-flex items-center justify-center min-h-[24px] px-2 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ef4444] text-white border border-[#dc2626]">Hết hàng</span> : null}
                  <img
                    src={getProductImageSrc(product)}
                    alt={product.name}
                    className={`w-full h-[212px] object-cover block ${outOfStock ? "grayscale-[55%] brightness-[88%]" : ""}`}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                </div>
                <h3 className="m-0 text-[17px] text-shop-ink font-bold">{product.name}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#fff5d9] text-[#92400e]">
                    {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)})
                  </span>
                  <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#e6f7ff] text-[#075985]">{Number(product.totalViews || 0)} lượt xem</span>
                  <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#ebfbe8] text-[#166534]">{Number(product.totalPurchases || 0)} lượt mua</span>
                </div>
                <p className="my-3 text-[#be2f00] text-[21px] font-extrabold">{pricing.finalPrice.toLocaleString("vi-VN")} đ</p>
                {pricing.hasDiscount ? (
                  <p className="-mt-1.5 mb-2.5 text-[#94a3b8] text-sm line-through font-bold">{pricing.basePrice.toLocaleString("vi-VN")} đ</p>
                ) : null}
              </Link>
              <div className="mt-auto grid gap-2 pt-3">
                <button
                  type="button"
                  disabled={pendingWishlistIds.includes(product._id)}
                  className={wishlistIds.includes(product._id)
                    ? "rounded-[14px] border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-70"
                    : "rounded-[14px] border border-[#fdba74] bg-[#fff7ed] text-[#c2410c] px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-[#ffedd5] disabled:cursor-not-allowed disabled:opacity-70"
                  }
                  onClick={() => handleToggleWishlist(product._id, product.name)}
                >
                  {pendingWishlistIds.includes(product._id)
                    ? "Đang xử lý..."
                    : wishlistIds.includes(product._id)
                    ? "Đã yêu thích"
                    : "Thêm yêu thích"}
                </button>
                <button
                  type="button"
                  className={outOfStock
                    ? "rounded-[14px] border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] px-3 py-2.5 text-sm font-bold cursor-not-allowed opacity-100"
                    : "rounded-[14px] border border-[#0f766e] bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:from-[#159287] hover:to-[#0f766e] disabled:cursor-not-allowed disabled:opacity-70"
                  }
                  disabled={outOfStock}
                  onClick={() => handleAddToCart(product)}
                >
                  {outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                </button>
              </div>
            </article>
            );
          })}
        </div>
      </section>

    </main>
  );
}

export default HomePage;