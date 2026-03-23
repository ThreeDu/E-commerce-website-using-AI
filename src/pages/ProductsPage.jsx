import { useState, useEffect } from "react";
import { Link, useLocation} from "react-router-dom";
import { useCart } from "../context/CartContext";

const allProducts = [
  { id: 1, name: "Điện thoại AI Pro", price: "25.000.000 đ", category: "Điện thoại" },
  { id: 2, name: "Laptop DevBook 16", price: "40.000.000 đ", category: "Laptop" },
  { id: 3, name: "Tai nghe Noise Cancel", price: "3.500.000 đ", category: "Phụ kiện" },
  { id: 4, name: "Đồng hồ thông minh", price: "5.000.000 đ", category: "Phụ kiện" },
  { id: 5, name: "Bàn phím cơ RGB", price: "2.100.000 đ", category: "Phụ kiện" },
  { id: 6, name: "Chuột không dây Ergonomic", price: "950.000 đ", category: "Phụ kiện" },
  { id: 7, name: "Màn hình 4K 27 inch", price: "12.500.000 đ", category: "Phụ kiện" },
  { id: 8, name: "Webcam Full HD", price: "1.200.000 đ", category: "Phụ kiện" },
];

const categories = ["Tất cả", "Điện thoại", "Laptop", "Máy tính bảng", "Phụ kiện"];

function ProductsPage() {
  const { addToCart } = useCart();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(location.state?.category || "Tất cả");
  const [filteredProducts, setFilteredProducts] = useState(allProducts);

  useEffect(() => {
    const results = allProducts.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = selectedCategory === "Tất cả" || product.category === selectedCategory;
      return matchSearch && matchCategory;
    });
    setFilteredProducts(results);
  }, [searchTerm, selectedCategory]);

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
        </aside>

        {/* Products Section */}
        <section style={{ flex: 1 }}>
          <h2 style={{ marginBottom: "24px", fontSize: "24px" }}>
            Tất cả sản phẩm
          </h2>
          {filteredProducts.length > 0 ? (
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
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
                  <Link to={`/products/${product.id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", flexGrow: 1 }}>
                    <div
                      style={{
                        width: "100%",
                        height: "200px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        marginBottom: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#adb5bd",
                        fontSize: "14px",
                      }}
                    >
                      Ảnh SP
                    </div>
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
                      {product.price}
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
                    onClick={() => addToCart(product)}
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
