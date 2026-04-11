import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

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
    setFilteredProducts(results);
  }, [searchTerm, selectedCategoryScope, maxPrice, allProducts]);

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
      {/* Breadcrumb Navigation */}
      <nav aria-label="breadcrumb" style={{ marginBottom: '24px' }}>
        <ol style={{ display: 'flex', listStyle: 'none', padding: 0, margin: 0, gap: '8px', color: '#6c757d' }}>
          <li><Link to="/" style={{ textDecoration: 'none', color: '#007bff' }}>Trang chủ</Link></li>
          <li>/</li>
          <li aria-current="page" style={{ fontWeight: 'bold', color: '#343a40' }}>Sản phẩm</li>
        </ol>
      </nav>

      <div style={{ display: "flex", gap: "32px" }}>
        {/* Filters Sidebar */}
        <aside style={{ width: "240px", flexShrink: 0 }}>
          <h3 style={{ marginBottom: "16px" }}>Bộ lọc</h3>
          <div style={{ marginBottom: "24px" }}>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ced4da" }}
            />
          </div>
          {/* You can add more filters here, e.g., by category, price range */}
          <h4>Danh mục</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {categories.map((cat) => (
              <li
                key={cat._id || cat.path}
                onClick={() => setSelectedCategoryId(String(cat._id))}
                style={{
                  marginBottom: '8px',
                  cursor: 'pointer',
                  fontWeight: selectedCategoryId === String(cat._id) ? 'bold' : 'normal',
                  color: selectedCategoryId === String(cat._id) ? '#007bff' : 'inherit'
                }}
              >
                {cat.path}
              </li>
            ))}
          </ul>

          {/* Bộ lọc thanh kéo mức giá */}
          <h4 style={{ marginTop: "24px", marginBottom: "8px" }}>Mức giá</h4>
          <div style={{ marginBottom: "24px" }}>
            <style>{`
              .custom-slider {
                -webkit-appearance: none;
                appearance: none;
                height: 6px;
                border-radius: 4px;
                outline: none;
              }
              .custom-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #007bff;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                transition: 0.2s;
              }
              .custom-slider::-webkit-slider-thumb:hover {
                transform: scale(1.15);
              }
              .custom-slider::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #007bff;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                border: none;
                transition: 0.2s;
              }
              .custom-slider::-moz-range-thumb:hover {
                transform: scale(1.15);
              }
            `}</style>
            <input
              type="range"
              min="0"
              max={maxPossiblePrice}
              step={Math.max(10000, Math.round(maxPossiblePrice / 200))}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="custom-slider"
              style={{ 
                width: "100%", 
                cursor: "pointer",
                background: `linear-gradient(to right, #007bff ${maxPossiblePrice > 0 ? (maxPrice / maxPossiblePrice) * 100 : 100}%, #e9ecef ${maxPossiblePrice > 0 ? (maxPrice / maxPossiblePrice) * 100 : 100}%)`
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginTop: "8px" }}>
              <span style={{ color: "#6c757d" }}>0 đ</span>
              <span style={{ fontWeight: "bold", color: "#dc3545" }}>
                Dưới {maxPrice.toLocaleString("vi-VN")} đ / Tối đa {maxPossiblePrice.toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>
        </aside>

        {/* Products Section */}
        <section style={{ flex: 1 }}>
          <h2 style={{ marginBottom: "24px", fontSize: "24px" }}>
            Tất cả sản phẩm
          </h2>
          {loading ? (
            <p>Đang tải danh sách sản phẩm...</p>
          ) : filteredProducts.length > 0 ? (
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              {filteredProducts.map((product) => {
                const productId = String(product._id);
                const isWishlisted = wishlistIds.includes(productId);
                const isPending = pendingWishlistIds.includes(productId);

                return (
                <div
                  key={productId}
                  style={{
                    flex: "1 1 calc(33.333% - 24px)", // Adjusted for 3 items per row
                    minWidth: "200px",
                    border: "1px solid #dee2e6",
                    borderRadius: "8px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <Link to={`/products/${product._id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", flexGrow: 1 }}>
                    <img
                      src={getProductImageSrc(product)}
                      alt={product.name}
                      style={{
                        width: "100%",
                        height: "200px",
                        borderRadius: "4px",
                        marginBottom: "16px",
                        objectFit: "cover",
                        backgroundColor: "#f8f9fa",
                      }}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = "/placeholder.jpg";
                      }}
                    />
                    <h4 style={{ fontSize: "18px", marginBottom: "8px" }}>
                      {product.name}
                    </h4>
                    <p style={{ marginTop: 0, marginBottom: "8px", color: "#f59e0b", fontWeight: "bold", fontSize: "14px" }}>
                      {Number(product.averageRating || 0).toFixed(1)} ★ ({Number(product.totalRatings || 0)})
                    </p>
                    <p style={{ marginTop: 0, marginBottom: "12px", color: "#64748b", fontSize: "13px" }}>
                      {Number(product.totalViews || 0)} lượt xem
                    </p>
                    <p
                      style={{
                        color: "#dc3545",
                        fontWeight: "bold",
                        fontSize: "19px",
                        marginBottom: "16px",
                      }}
                    >
                      {product.price.toLocaleString("vi-VN")} đ
                    </p>
                  </Link>
                  <button
                    type="button"
                    disabled={isPending}
                    style={{
                      marginBottom: "8px",
                      padding: "8px",
                      backgroundColor: isWishlisted ? "#ffe3e3" : "#fff",
                      color: isWishlisted ? "#c92a2a" : "#495057",
                      border: "1px solid #dee2e6",
                      borderRadius: "4px",
                      cursor: isPending ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                    onClick={() => handleToggleWishlist(productId)}
                  >
                    {isPending ? "Đang xử lý..." : isWishlisted ? "Đã yêu thích ♥" : "Thêm yêu thích ♡"}
                  </button>
                  <button
                    style={{
                      marginTop: "auto",
                      padding: "8px",
                      backgroundColor: "#28a745",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                    onClick={() => handleAddToCart(product)}
                  >
                    Thêm vào giỏ
                  </button>
                </div>
                );
              })}
            </div>
          ) : (
            <p>Không tìm thấy sản phẩm nào phù hợp.</p>
          )}
        </section>
      </div>
    </main>
  );
}

export default ProductsPage;
