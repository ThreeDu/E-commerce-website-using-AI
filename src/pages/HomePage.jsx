import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { getProductImageSrc, getProductPricing, isOutOfStock } from "../utils/productUtils";
import { fetchProducts } from "../services/productService";
import { fetchCategories } from "../services/categoryService";
import { fetchRecommendations } from "../services/recommendationService";
import "../css/home-neo.css";
import "../css/shop-experience.css";

function HomePage() {
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [recommendReady, setRecommendReady] = useState(false);

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

  // Fetch personalized recommendations
  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const data = await fetchRecommendations({
          token: auth?.token,
          limit: 8,
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
  }, [auth?.token]);

  const handleCategoryClick = (category) => {
    navigate("/products", {
      state: {
        categoryId: String(category._id),
        category: category.name,
      },
    });
  };

  const handleBuyNow = (product) => {
    if (!auth?.token) {
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }

    addToCart({ ...product, id: product._id });
    navigate("/checkout");
  };

  return (
    <main className="container page-content neo-home-page">
      <section className="neo-hero-block">
        <div className="neo-hero-main">
          <p className="neo-eyebrow">Thương mại ưu tiên công nghệ</p>
          <h2>Trải nghiệm nổi bật.</h2>
          <p>
            Tech Shop mang tinh thần Neo-Brutalism: đường nét rõ ràng, độ tương phản cao và trải nghiệm mua sắm gọn, nhanh, chính xác.
          </p>
          <div className="neo-hero-actions">
            <Link to="/products" className="neo-btn neo-btn-primary">Mua ngay</Link>
            <Link to="/about" className="neo-btn neo-btn-ghost">Khám phá thêm</Link>
          </div>
        </div>
      </section>

      {/* ── Gợi ý sản phẩm cá nhân hóa ── */}
      {recommendReady && recommendedProducts.length > 0 && (
        <section className="neo-section neo-recommend-section" id="recommendations">
          <div className="neo-section-head">
            <h3>
              <span className="neo-recommend-icon" aria-hidden="true">✨</span>
              {" "}Gợi ý cho bạn
              <span className="neo-recommend-badge">AI</span>
            </h3>
            <Link to="/products">Xem tất cả</Link>
          </div>
          <div className="neo-bento-grid neo-bento-grid-products neo-recommend-grid">
            {recommendedProducts.map((product, index) => {
              const pricing = getProductPricing(product);
              const outOfStock = isOutOfStock(product);

              return (
                <article
                  className="shopx-card neo-recommend-card"
                  key={product._id}
                  style={{ animationDelay: `${index * 0.06}s` }}
                >
                  <Link to={`/products/${product._id}`} style={{ textDecoration: "none" }}>
                    <div className={`shopx-card-image-wrap ${outOfStock ? "is-out-of-stock" : ""}`}>
                      {pricing.hasDiscount ? <span className="shopx-sale-badge">-{pricing.discountPercent}%</span> : null}
                      {outOfStock ? <span className="shopx-stock-badge">Hết hàng</span> : null}
                      <img
                        src={getProductImageSrc(product)}
                        alt={product.name}
                        className="shopx-card-image"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                    </div>
                    <h3 className="shopx-card-name">{product.name}</h3>
                    <div className="shopx-meta-row">
                      <span className="shopx-chip shopx-chip--rating">
                        {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)})
                      </span>
                      <span className="shopx-chip shopx-chip--sold">{Number(product.totalPurchases || 0)} lượt mua</span>
                    </div>
                    <p className="shopx-price">{pricing.finalPrice.toLocaleString("vi-VN")} đ</p>
                    {pricing.hasDiscount ? (
                      <p className="shopx-old-price">{pricing.basePrice.toLocaleString("vi-VN")} đ</p>
                    ) : null}
                  </Link>
                  <div className="shopx-card-actions">
                    <button
                      className={`shopx-btn shopx-btn--buy-now ${outOfStock ? "shopx-btn--out-of-stock" : ""}`}
                      disabled={outOfStock}
                      onClick={() => handleBuyNow(product)}
                    >
                      {outOfStock ? "Hết hàng" : "Mua ngay"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section id="about" className="neo-section">
        <div className="neo-section-head">
          <h3>Khám phá theo danh mục</h3>
          <Link to="/products">Xem tất cả sản phẩm</Link>
        </div>
        <div className="neo-bento-grid neo-bento-grid-categories">
          {level2Categories.map((category, index) => (
            <button
              type="button"
              key={category._id}
              onClick={() => handleCategoryClick(category)}
              className={`neo-bento-card neo-cat-${index % 5}`}
            >
              <span>Dòng sản phẩm</span>
              <strong>{category.name}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="neo-section">
        <div className="neo-section-head">
          <h3>Sản phẩm nổi bật</h3>
          <Link to="/products">Mua theo bộ sưu tập</Link>
        </div>
        <div className="neo-bento-grid neo-bento-grid-products">
          {featuredProducts.map((product) => {
            const pricing = getProductPricing(product);
            const outOfStock = isOutOfStock(product);

            return (
            <article className="shopx-card" key={product._id}>
              <Link to={`/products/${product._id}`} style={{ textDecoration: "none" }}>
                <div className={`shopx-card-image-wrap ${outOfStock ? "is-out-of-stock" : ""}`}>
                  {pricing.hasDiscount ? <span className="shopx-sale-badge">-{pricing.discountPercent}%</span> : null}
                  {outOfStock ? <span className="shopx-stock-badge">Hết hàng</span> : null}
                  <img
                    src={getProductImageSrc(product)}
                    alt={product.name}
                    className="shopx-card-image"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                </div>
                <h3 className="shopx-card-name">{product.name}</h3>
                <div className="shopx-meta-row">
                  <span className="shopx-chip shopx-chip--rating">
                    {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)})
                  </span>
                  <span className="shopx-chip shopx-chip--views">{Number(product.totalViews || 0)} lượt xem</span>
                  <span className="shopx-chip shopx-chip--sold">{Number(product.totalPurchases || 0)} lượt mua</span>
                </div>
                <p className="shopx-price">{pricing.finalPrice.toLocaleString("vi-VN")} đ</p>
                {pricing.hasDiscount ? (
                  <p className="shopx-old-price">{pricing.basePrice.toLocaleString("vi-VN")} đ</p>
                ) : null}
              </Link>
              <div className="shopx-card-actions">
                <button
                  className={`shopx-btn shopx-btn--buy-now ${outOfStock ? "shopx-btn--out-of-stock" : ""}`}
                  disabled={outOfStock}
                  onClick={() => handleBuyNow(product)}
                >
                  {outOfStock ? "Hết hàng" : "Mua ngay"}
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