import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import "../css/shop-experience.css";

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

function getProductPricing(product) {
  const basePrice = Math.max(0, Number(product?.price || 0));
  const rawDiscountPercent = Math.max(0, Math.min(100, Number(product?.discountPercent || 0)));
  const finalPriceFromApi = Math.max(0, Number(product?.finalPrice || 0));

  const fallbackFinalPrice = Math.round(basePrice * (1 - rawDiscountPercent / 100));
  const finalPrice =
    finalPriceFromApi > 0 && finalPriceFromApi < basePrice ? finalPriceFromApi : fallbackFinalPrice;

  const hasDiscount = basePrice > 0 && finalPrice < basePrice;
  const discountPercent = hasDiscount
    ? Math.max(1, Math.round(((basePrice - finalPrice) / basePrice) * 100))
    : 0;

  return {
    basePrice,
    finalPrice: hasDiscount ? finalPrice : basePrice,
    hasDiscount,
    discountPercent,
  };
}

function isOutOfStock(product) {
  return Number(product?.stock || 0) <= 0;
}

function normalizeCategoryId(value) {
  return String(value || "").trim();
}

function ProductsPage() {
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryLevel1, setCategoryLevel1] = useState("all");
  const [categoryLevel2, setCategoryLevel2] = useState("all");
  const [categoryLevel3, setCategoryLevel3] = useState("all");
  const [sortBy, setSortBy] = useState("best-selling");
  const [maxPrice, setMaxPrice] = useState(100000000); // Mức giá đang chọn (mặc định để rất lớn)
  const [maxPossiblePrice, setMaxPossiblePrice] = useState(100000000); // Mức giá lớn nhất có trong data
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [pendingWishlistIds, setPendingWishlistIds] = useState([]);
  const [categories, setCategories] = useState([{ _id: "all", name: "Tất cả", path: "Tất cả" }]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!auth?.token) {
        setWishlistIds([]);
        return;
      }

      try {
        const response = await fetch("/api/auth/wishlist", {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        if (!response.ok) {
          setWishlistIds([]);
          return;
        }

        const data = await response.json();
        const ids = Array.isArray(data?.wishlist)
          ? data.wishlist.map((item) => String(item._id))
          : [];
        setWishlistIds(ids);
      } catch (error) {
        setWishlistIds([]);
      }
    };

    fetchWishlist();
  }, [auth?.token]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Gọi API lấy danh sách sản phẩm
        const productsRes = await fetch("/api/products");
        if (productsRes.ok) {
          const data = await productsRes.json();
          setAllProducts(data);
          
          // Tự động tìm giá lớn nhất trong database để làm mốc cho thanh kéo
          if (data.length > 0) {
            const highestPrice = Math.max(...data.map(item => item.price));
            setMaxPossiblePrice(highestPrice);
            setMaxPrice(highestPrice); // Mặc định thanh kéo sẽ nằm ở mức cao nhất
          }
        }

        // 2. Gọi API lấy danh sách danh mục (API mới tạo)
        const categoriesRes = await fetch("/api/categories");
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json();
          const categoryMap = new Map();
          catData.forEach((cat) => {
            categoryMap.set(String(cat._id), cat);
          });

          const buildPath = (category) => {
            const path = [category.name];
            let cursor = category;
            const visited = new Set();

            while (cursor?.parentId) {
              const parentId = String(cursor.parentId);
              if (visited.has(parentId)) {
                break;
              }
              visited.add(parentId);

              const parent = categoryMap.get(parentId);
              if (!parent) {
                break;
              }

              path.unshift(parent.name);
              cursor = parent;
            }

            return path.join(" > ");
          };

          const normalizedCategories = catData
            .map((cat) => ({ ...cat, path: buildPath(cat) }))
            .sort((a, b) => a.path.localeCompare(b.path, "vi", { sensitivity: "base" }));

          setCategories([{ _id: "all", name: "Tất cả", path: "Tất cả" }, ...normalizedCategories]);
        }

      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const keyword = new URLSearchParams(location.search).get("keyword");
    if (keyword) {
      setSearchTerm(keyword);
    }
  }, [location.search]);

  const categoryItems = useMemo(
    () => categories.filter((item) => item._id !== "all"),
    [categories]
  );

  const categoryMap = useMemo(
    () => new Map(categoryItems.map((item) => [normalizeCategoryId(item._id), item])),
    [categoryItems]
  );

  const level1Categories = categoryItems.filter((item) => !item.parentId);

  const level2Categories =
    categoryLevel1 === "all"
      ? []
      : categoryItems.filter(
          (item) => normalizeCategoryId(item.parentId) === normalizeCategoryId(categoryLevel1)
        );

  const level3Categories =
    categoryLevel2 === "all"
      ? []
      : categoryItems.filter(
          (item) => normalizeCategoryId(item.parentId) === normalizeCategoryId(categoryLevel2)
        );

  const selectedCategoryId =
    categoryLevel3 !== "all"
      ? categoryLevel3
      : categoryLevel2 !== "all"
        ? categoryLevel2
        : categoryLevel1;

  useEffect(() => {
    if (categories.length <= 1) {
      return;
    }

    const applyCategoryLevels = (targetId) => {
      const normalizedId = normalizeCategoryId(targetId);
      const target = categoryMap.get(normalizedId);
      if (!target) {
        return false;
      }

      const path = [];
      let cursor = target;
      const visited = new Set();

      while (cursor) {
        const cursorId = normalizeCategoryId(cursor._id);
        if (!cursorId || visited.has(cursorId)) {
          break;
        }

        visited.add(cursorId);
        path.unshift(cursor);

        const parentId = normalizeCategoryId(cursor.parentId);
        if (!parentId) {
          break;
        }
        cursor = categoryMap.get(parentId);
      }

      setCategoryLevel1(normalizeCategoryId(path[0]?._id) || "all");
      setCategoryLevel2(normalizeCategoryId(path[1]?._id) || "all");
      setCategoryLevel3(normalizeCategoryId(path[2]?._id) || "all");
      return true;
    };

    const stateCategoryId = location.state?.categoryId;
    if (stateCategoryId) {
      if (applyCategoryLevels(stateCategoryId)) {
        return;
      }
    }

    const stateCategory = String(location.state?.category || "").trim();
    if (!stateCategory) {
      return;
    }

    const matchedByPath = categoryItems.find((item) => item.path === stateCategory);
    if (matchedByPath && applyCategoryLevels(matchedByPath._id)) {
      return;
    }

    const matchedByName = categoryItems.find((item) => item.name === stateCategory);
    if (matchedByName) {
      applyCategoryLevels(matchedByName._id);
    }
  }, [categories, categoryItems, categoryMap, location.state?.category, location.state?.categoryId]);

  const categoriesById = new Map(
    categoryItems.map((item) => [String(item._id), item])
  );

  const childrenByParentId = new Map();
  categoryItems.forEach((item) => {

    const key = item.parentId ? String(item.parentId) : "root";
    const next = childrenByParentId.get(key) || [];
    next.push(item);
    childrenByParentId.set(key, next);
  });

  const selectedCategoryScope = (() => {
    if (selectedCategoryId === "all") {
      return null;
    }

    const root = categoriesById.get(String(selectedCategoryId));
    if (!root) {
      return null;
    }

    const matchedCategories = [];
    const queue = [root];
    const visited = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      const currentId = String(current._id);
      if (visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      matchedCategories.push(current);

      const children = childrenByParentId.get(currentId) || [];
      children.forEach((child) => queue.push(child));
    }

    return {
      names: new Set(matchedCategories.map((item) => item.name)),
      paths: matchedCategories
        .map((item) => String(item.path || "").trim())
        .filter(Boolean),
    };
  })();

  useEffect(() => {
    const results = allProducts.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const productCategory = String(product.category || "").trim();
      const matchCategory = (() => {
        if (!selectedCategoryScope) {
          return true;
        }

        if (selectedCategoryScope.names.has(productCategory)) {
          return true;
        }

        return selectedCategoryScope.paths.some(
          (path) => productCategory === path || productCategory.startsWith(`${path} >`)
        );
      })();
      const matchPrice = product.price <= maxPrice;
      return matchSearch && matchCategory && matchPrice;
    });

    const sortedResults = [...results].sort((a, b) => {
      if (sortBy === "most-viewed") {
        return Number(b.totalViews || 0) - Number(a.totalViews || 0);
      }

      if (sortBy === "top-rated") {
        const ratingDiff = Number(b.averageRating || 0) - Number(a.averageRating || 0);
        if (ratingDiff !== 0) {
          return ratingDiff;
        }
        return Number(b.totalRatings || 0) - Number(a.totalRatings || 0);
      }

      const soldDiff = Number(b.totalPurchases || 0) - Number(a.totalPurchases || 0);
      if (soldDiff !== 0) {
        return soldDiff;
      }

      return Number(b.totalViews || 0) - Number(a.totalViews || 0);
    });

    setFilteredProducts(sortedResults);
  }, [searchTerm, selectedCategoryScope, maxPrice, allProducts, sortBy]);

  const handleAddToCart = (product) => {
    if (!auth?.token) {
      navigate("/login", { state: { from: "/products" } });
      return;
    }

    addToCart({ ...product, id: product._id });
  };

  const handleToggleWishlist = async (productId) => {
    if (!auth?.token) {
      navigate("/login", { state: { from: "/products" } });
      return;
    }

    if (pendingWishlistIds.includes(productId)) {
      return;
    }

    const isWishlisted = wishlistIds.includes(productId);
    setPendingWishlistIds((prev) => [...prev, productId]);

    try {
      const response = await fetch(
        isWishlisted ? `/api/auth/wishlist/${productId}` : "/api/auth/wishlist",
        {
          method: isWishlisted ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: isWishlisted ? undefined : JSON.stringify({ productId }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        return;
      }

      const ids = Array.isArray(data?.wishlist)
        ? data.wishlist.map((item) => String(item._id))
        : [];
      setWishlistIds(ids);
    } catch (error) {
      console.error("Lỗi cập nhật wishlist:", error);
    } finally {
      setPendingWishlistIds((prev) => prev.filter((id) => id !== productId));
    }
  };

  return (
    <main className="container page-content">
      <div className="shopx-page">
        <div className="shopx-shell">
          <aside className="shopx-panel shopx-panel--sticky">
            <h3 className="shopx-filter-title">Bộ lọc</h3>
            <div className="shopx-field">
              <input
                className="shopx-input"
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="shopx-field">
              <h4 style={{ margin: 0 }}>Sắp xếp</h4>
              <select className="shopx-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="best-selling">Bán chạy nhất</option>
                <option value="most-viewed">Xem nhiều nhất</option>
                <option value="top-rated">Đánh giá cao nhất</option>
              </select>
            </div>

            <div className="shopx-field">
              <h4 style={{ margin: 0 }}>Danh mục</h4>
              <select
                className="shopx-select"
                value={categoryLevel1}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCategoryLevel1(nextValue);
                  setCategoryLevel2("all");
                  setCategoryLevel3("all");
                }}
              >
                <option value="all">Tất cả danh mục</option>
                {level1Categories.map((cat) => (
                  <option key={cat._id} value={String(cat._id)}>
                    {cat.name}
                  </option>
                ))}
              </select>

              {categoryLevel1 !== "all" && (
                <select
                  className="shopx-select"
                  value={categoryLevel2}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setCategoryLevel2(nextValue);
                    setCategoryLevel3("all");
                  }}
                >
                  <option value="all">Tất cả thương hiệu</option>
                  {level2Categories.map((cat) => (
                    <option key={cat._id} value={String(cat._id)}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}

              {categoryLevel2 !== "all" && level3Categories.length > 0 && (
                <select
                  className="shopx-select"
                  value={categoryLevel3}
                  onChange={(event) => setCategoryLevel3(event.target.value)}
                >
                  <option value="all">Tất cả dòng sản phẩm</option>
                  {level3Categories.map((cat) => (
                    <option key={cat._id} value={String(cat._id)}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="shopx-field">
              <h4 style={{ margin: 0 }}>Mức giá</h4>
              <div className="shopx-range-wrap">
                <input
                  className="shopx-range"
                  type="range"
                  min="0"
                  max={maxPossiblePrice}
                  step={Math.max(10000, Math.round(maxPossiblePrice / 200))}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
                <div className="shopx-range-text">
                  Dưới {maxPrice.toLocaleString("vi-VN")} đ / Tối đa {maxPossiblePrice.toLocaleString("vi-VN")} đ
                </div>
              </div>
            </div>
          </aside>

          <section>
            <div className="shopx-panel shopx-hero">
              <div>
                <h1 className="shopx-title">Kho sản phẩm</h1>
                <p className="shopx-subtitle">
                  Các sản phẩm hiện tại đang được bày bán.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="shopx-empty">Đang tải danh sách sản phẩm...</div>
            ) : filteredProducts.length > 0 ? (
              <div className="shopx-grid">
                {filteredProducts.map((product) => {
                  const productId = String(product._id);
                  const isWishlisted = wishlistIds.includes(productId);
                  const isPending = pendingWishlistIds.includes(productId);
                  const outOfStock = isOutOfStock(product);
                  const pricing = getProductPricing(product);

                  return (
                    <article key={productId} className="shopx-card">
                      <Link to={`/products/${product._id}`} style={{ textDecoration: "none" }}>
                        <div className={`shopx-card-image-wrap ${outOfStock ? "is-out-of-stock" : ""}`}>
                          {pricing.hasDiscount ? (
                            <span className="shopx-sale-badge">-{pricing.discountPercent}%</span>
                          ) : null}
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
                          type="button"
                          disabled={isPending}
                          className={`shopx-btn shopx-btn--ghost shopx-btn--wishlist ${isWishlisted ? "shopx-btn--active" : ""}`}
                          onClick={() => handleToggleWishlist(productId)}
                        >
                          {isPending ? "Đang xử lý..." : isWishlisted ? "Đã yêu thích" : "Thêm yêu thích"}
                        </button>
                        <button
                          type="button"
                          className={`shopx-btn shopx-btn--primary shopx-btn--cart ${outOfStock ? "shopx-btn--out-of-stock" : ""}`}
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
            ) : (
              <div className="shopx-empty">Không tìm thấy sản phẩm phù hợp.</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default ProductsPage;
