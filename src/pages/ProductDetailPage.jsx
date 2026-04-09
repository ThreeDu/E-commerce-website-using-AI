import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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

function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { auth } = useAuth();
  const navigate = useNavigate();
    const handleAddToCart = () => {
      if (!auth?.token) {
        navigate("/login", { state: { from: `/products/${id}` } });
        return;
      }

      addToCart({ ...product, id: product._id });
    };

  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${id}`);
        if (response.ok) {
          const data = await response.json();
          setProduct(data);
        }
      } catch (error) {
        console.error("Lỗi khi tải chi tiết sản phẩm:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return <main className="container page-content" style={{ textAlign: "center", padding: "100px 20px" }}><h2>Đang tải thông tin...</h2></main>;
  }

  if (!product) {
    return (
      <main className="container page-content" style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2 style={{ marginBottom: "16px" }}>Không tìm thấy sản phẩm!</h2>
        <Link to="/products" style={{ color: "#007bff", textDecoration: "none", fontWeight: "bold" }}>Quay lại trang Sản phẩm</Link>
      </main>
    );
  }

  return (
    <main className="container page-content" style={{ padding: "0 20px" }}>
      {/* Điều hướng Breadcrumb */}
      <nav aria-label="breadcrumb" style={{ marginBottom: '24px' }}>
        <ol style={{ display: 'flex', listStyle: 'none', padding: 0, margin: 0, gap: '8px', color: '#6c757d' }}>
          <li><Link to="/" style={{ textDecoration: 'none', color: '#007bff' }}>Trang chủ</Link></li>
          <li>/</li>
          <li><Link to="/products" style={{ textDecoration: 'none', color: '#007bff' }}>Sản phẩm</Link></li>
          <li>/</li>
          <li aria-current="page" style={{ fontWeight: 'bold', color: '#343a40' }}>{product.name}</li>
        </ol>
      </nav>

      <div style={{ display: "flex", gap: "48px", flexWrap: "wrap", backgroundColor: "#fff", padding: "32px", borderRadius: "8px", border: "1px solid #dee2e6" }}>
        {/* Cột hiển thị hình ảnh */}
        <div style={{ flex: "1 1 40%", minWidth: "300px", borderRadius: "8px", border: "1px solid #dee2e6", overflow: "hidden", backgroundColor: "#f8f9fa" }}>
          <img
            src={getProductImageSrc(product)}
            alt={product.name}
            style={{ width: "100%", height: "400px", objectFit: "cover" }}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = "/placeholder.jpg";
            }}
          />
        </div>

        {/* Cột thông tin chi tiết */}
        <div style={{ flex: "1 1 50%", minWidth: "300px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontSize: "32px", marginBottom: "16px", marginTop: 0 }}>{product.name}</h2>
          <p style={{ color: "#6c757d", fontSize: "16px", marginBottom: "16px" }}>Danh mục: <strong>{product.category}</strong></p>
          <p style={{ fontSize: "28px", fontWeight: "bold", color: "#dc3545", marginBottom: "24px" }}>{product.price.toLocaleString("vi-VN")} đ</p>
          <div style={{ marginBottom: "32px", lineHeight: "1.6", color: "#495057" }}>
            <h4 style={{ marginBottom: "8px" }}>Mô tả sản phẩm:</h4>
            <p>{product.description}</p>
          </div>
          <button onClick={handleAddToCart} style={{ padding: "16px 32px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", fontSize: "18px", fontWeight: "bold", cursor: "pointer", width: "fit-content" }}>
            Thêm vào giỏ hàng
          </button>
        </div>
      </div>
    </main>
  );
}

export default ProductDetailPage;