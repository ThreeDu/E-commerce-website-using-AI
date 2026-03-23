import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";

function HomePage() {
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const mockProducts = [
    { id: 1, name: "Điện thoại AI Pro", price: "25.000.000 đ" },
    { id: 2, name: "Laptop DevBook 16", price: "40.000.000 đ" },
    { id: 3, name: "Tai nghe Noise Cancel", price: "3.500.000 đ" },
    { id: 4, name: "Đồng hồ thông minh", price: "5.000.000 đ" },
  ];

  const handleCategoryClick = (category) => {
    navigate("/products", { state: { category } });
  };

  return (
    <main className="container page-content" style={{ padding: "0 20px" }}>
      {/* Hero Banner Section */}
      <section 
        className="hero-card" 
        style={{ 
          textAlign: "center", 
          padding: "48px 16px", 
          backgroundColor: "#f8f9fa", 
          borderRadius: "8px", 
          marginBottom: "32px" 
        }}
      >
        <h2 style={{ fontSize: "32px", marginBottom: "16px" }}>Chào mừng đến với AI Shop</h2>
        <p style={{ fontSize: "16px" }}>
          Khám phá hàng ngàn sản phẩm công nghệ và tiện ích với giá cực ưu đãi.
        </p>
        <Link 
          to="/products" 
          style={{ 
            display: "inline-block", 
            marginTop: "16px", 
            padding: "12px 24px", 
            backgroundColor: "#007bff", 
            color: "white", 
            textDecoration: "none", 
            borderRadius: "4px",
            fontWeight: "bold"
          }}
        >
          Mua sắm ngay
        </Link>
      </section>

      {/* Categories Section */}
      <section style={{ marginBottom: "48px" }}>
        <h3 style={{ marginBottom: "24px", fontSize: "24px" }}>Danh mục nổi bật</h3>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {["Điện thoại", "Laptop", "Máy tính bảng", "Phụ kiện"].map((category, index) => (
            <div 
              key={index} 
              onClick={() => handleCategoryClick(category)}
              style={{ 
                flex: "1 1 calc(25% - 16px)", 
                minWidth: "150px", 
                padding: "32px 16px", 
                backgroundColor: "#e9ecef", 
                textAlign: "center", 
                borderRadius: "8px", 
                fontWeight: "bold", 
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              {category}
            </div>
          ))}
        </div>
      </section>

      {/* Featured Products Section */}
      <section>
        <h3 style={{ marginBottom: "24px", fontSize: "24px" }}>Sản phẩm bán chạy</h3>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          {mockProducts.map((product) => (
            <div 
              key={product.id} 
              style={{ 
                flex: "1 1 calc(25% - 24px)", 
                minWidth: "200px", 
                border: "1px solid #dee2e6", 
                borderRadius: "8px", 
                padding: "16px", 
                display: "flex", 
                flexDirection: "column",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
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
                    fontSize: "14px"
                  }}
                >
                  Ảnh SP
                </div>
                <h4 style={{ fontSize: "18px", marginBottom: "8px" }}>{product.name}</h4>
                <p 
                  style={{ 
                    color: "#dc3545", 
                    fontWeight: "bold", 
                    fontSize: "19px", 
                    marginBottom: "16px" 
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
                  fontSize: "14px"
                }}
                onClick={() => addToCart(product)}
              >
                Thêm vào giỏ
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default HomePage;