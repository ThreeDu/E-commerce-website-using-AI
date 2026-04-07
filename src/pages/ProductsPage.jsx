import { useState, useEffect } from "react";
import { Link, useLocation} from "react-router-dom";
import { useCart } from "../context/CartContext";

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
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(location.state?.category || "Tất cả");
  const [maxPrice, setMaxPrice] = useState(100000000); // Mức giá đang chọn (mặc định để rất lớn)
  const [maxPossiblePrice, setMaxPossiblePrice] = useState(100000000); // Mức giá lớn nhất có trong data
  const [allProducts, setAllProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState(["Tất cả"]);
  const [loading, setLoading] = useState(true);

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
          // Lấy tên các danh mục từ DB và đẩy chữ "Tất cả" lên vị trí đầu tiên
          setCategories(["Tất cả", ...catData.map(cat => cat.name)]);
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
    const results = allProducts.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === "Tất cả" || product.category === selectedCategory;
      const matchPrice = product.price <= maxPrice;
      return matchSearch && matchCategory && matchPrice;
    });
    setFilteredProducts(results);
  }, [searchTerm, selectedCategory, maxPrice, allProducts]);

  useEffect(() => {
    if (location.state?.category) {
      setSelectedCategory(location.state.category);
    }
  }, [location.state?.category]);

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
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  marginBottom: '8px',
                  cursor: 'pointer',
                  fontWeight: selectedCategory === cat ? 'bold' : 'normal',
                  color: selectedCategory === cat ? '#007bff' : 'inherit'
                }}
              >
                {cat}
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
              step="500000" // Mỗi lần kéo nhích 500k
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
                Dưới {maxPrice.toLocaleString("vi-VN")} đ
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
              {filteredProducts.map((product) => (
                <div
                  key={product._id}
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
                    onClick={() => addToCart({ ...product, id: product._id })}
                  >
                    Thêm vào giỏ
                  </button>
                </div>
              ))}
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
