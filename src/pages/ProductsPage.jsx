import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import "../css/shop-experience.css";

function getProductImageSrc(product) {
  const rawValue = String(product?.image || product?.imageUrl || "").trim();
  if (!rawValue) {
    return "/placeholder.jpg";
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

function ProductsPage() {
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
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

  useEffect(() => {
    if (categories.length <= 1) {
      return;
    }

    const stateCategoryId = location.state?.categoryId;
    if (stateCategoryId) {
      const matchedById = categories.find((item) => String(item._id) === String(stateCategoryId));
      if (matchedById) {
        setSelectedCategoryId(String(matchedById._id));
        return;
      }
    }

    const stateCategory = String(location.state?.category || "").trim();
    if (!stateCategory) {
      return;
    }

    const matchedByPath = categories.find((item) => item.path === stateCategory);
    if (matchedByPath) {
      setSelectedCategoryId(String(matchedByPath._id));
      return;
    }

    const matchedByName = categories.find((item) => item.name === stateCategory);
    if (matchedByName) {
      setSelectedCategoryId(String(matchedByName._id));
    }
  }, [categories, location.state?.category, location.state?.categoryId]);

  const categoriesById = new Map(
    categories
      .filter((item) => item._id !== "all")
      .map((item) => [String(item._id), item])
  );

  const childrenByParentId = new Map();
  categories.forEach((item) => {
    if (item._id === "all") {
      return;
    }

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
        <nav className="shopx-breadcrumb" aria-label="breadcrumb">
          <ol>
            <li>
              <Link to="/">Trang chủ</Link>
            </li>
            <li>/</li>
            <li aria-current="page">Sản phẩm</li>
          </ol>
        </nav>

        <div className="shopx-shell">
          <aside className="shopx-panel shopx-panel--sticky">
            <h3 className="shopx-filter-title">Bộ lọc thông minh</h3>
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
              <ul className="shopx-list">
                {categories.map((cat) => (
                  <li
                    key={cat._id || cat.path}
                    onClick={() => setSelectedCategoryId(String(cat._id))}
                    className={`shopx-list-item ${selectedCategoryId === String(cat._id) ? "is-active" : ""}`}
                  >
                    {cat.path}
                  </li>
                ))}
              </ul>
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
                <h1 className="shopx-title">Kho san pham cong nghe</h1>
                <p className="shopx-subtitle">
                  Loc theo danh muc va gia de tim dung san pham can mua. The hien ro danh gia, luot xem va luot mua.
                </p>
              </div>
              <div className="shopx-pills">
                <span className="shopx-pill">{allProducts.length} San pham</span>
                <span className="shopx-pill">{filteredProducts.length} Ket qua</span>
              </div>
            </div>

            {loading ? (
              <div className="shopx-empty">Dang tai danh sach san pham...</div>
            ) : filteredProducts.length > 0 ? (
              <div className="shopx-grid">
                {filteredProducts.map((product) => {
                  const productId = String(product._id);
                  const isWishlisted = wishlistIds.includes(productId);
                  const isPending = pendingWishlistIds.includes(productId);

                  return (
                    <article key={productId} className="shopx-card">
                      <Link to={`/products/${product._id}`} style={{ textDecoration: "none" }}>
                        <div className="shopx-card-image-wrap">
                          <img
                            src={getProductImageSrc(product)}
                            alt={product.name}
                            className="shopx-card-image"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = "/placeholder.jpg";
                            }}
                          />
                        </div>
                        <h3 className="shopx-card-name">{product.name}</h3>
                        <div className="shopx-meta-row">
                          <span className="shopx-chip shopx-chip--rating">
                            {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)})
                          </span>
                          <span className="shopx-chip shopx-chip--views">{Number(product.totalViews || 0)} luot xem</span>
                          <span className="shopx-chip shopx-chip--sold">{Number(product.totalPurchases || 0)} luot mua</span>
                        </div>
                        <p className="shopx-price">{Number(product.price || 0).toLocaleString("vi-VN")} đ</p>
                      </Link>

                      <div className="shopx-card-actions">
                        <button
                          type="button"
                          disabled={isPending}
                          className={`shopx-btn shopx-btn--ghost ${isWishlisted ? "shopx-btn--active" : ""}`}
                          onClick={() => handleToggleWishlist(productId)}
                        >
                          {isPending ? "Dang xu ly..." : isWishlisted ? "Da yeu thich" : "Them yeu thich"}
                        </button>
                        <button
                          type="button"
                          className="shopx-btn shopx-btn--primary"
                          onClick={() => handleAddToCart(product)}
                        >
                          Them vao gio
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="shopx-empty">Khong tim thay san pham phu hop.</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default ProductsPage;
