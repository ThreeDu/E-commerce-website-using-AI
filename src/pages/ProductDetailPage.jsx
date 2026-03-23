import { useParams, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

// Giữ nguyên mảng mock data này tạm thời để demo (sau này sẽ đổi sang gọi API)
const allProducts = [
  { id: 1, name: "Điện thoại AI Pro", price: "25.000.000 đ", category: "Điện thoại", description: "Điện thoại thông minh tích hợp AI mới nhất, camera siêu nét 108MP, pin trâu 5000mAh." },
  { id: 2, name: "Laptop DevBook 16", price: "40.000.000 đ", category: "Laptop", description: "Cỗ máy làm việc với chip hiệu năng cao, RAM 32GB, ổ cứng SSD 1TB chuẩn PCIe 4.0." },
  { id: 3, name: "Tai nghe Noise Cancel", price: "3.500.000 đ", category: "Phụ kiện", description: "Tai nghe chống ồn chủ động ANC, âm thanh Hi-Res chân thực, pin sử dụng liên tục 30 giờ." },
  { id: 4, name: "Đồng hồ thông minh", price: "5.000.000 đ", category: "Phụ kiện", description: "Theo dõi sức khỏe toàn diện, đo nhịp tim, nồng độ oxy trong máu, chống nước chuẩn 5ATM." },
  { id: 5, name: "Bàn phím cơ RGB", price: "2.100.000 đ", category: "Phụ kiện", description: "Bàn phím cơ sử dụng switch cao cấp, tích hợp LED RGB 16.8 triệu màu tùy chỉnh, gõ cực êm." },
  { id: 6, name: "Chuột không dây Ergonomic", price: "950.000 đ", category: "Phụ kiện", description: "Thiết kế công thái học chống mỏi tay khi dùng lâu, kết nối wireless độ trễ thấp, pin sạc dùng 3 tháng." },
  { id: 7, name: "Màn hình 4K 27 inch", price: "12.500.000 đ", category: "Phụ kiện", description: "Màn hình độ phân giải 4K sắc nét, chuẩn màu 99% sRGB dành cho dân thiết kế, tích hợp công nghệ bảo vệ mắt." },
  { id: 8, name: "Webcam Full HD", price: "1.200.000 đ", category: "Phụ kiện", description: "Webcam 1080p sắc nét lý tưởng cho học tập và họp trực tuyến, tích hợp micro chống ồn kép." },
];

function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useCart();
  
  // Tìm sản phẩm trong mảng dựa theo ID trên thanh URL
  const product = allProducts.find((p) => p.id === parseInt(id, 10));

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
        <div style={{ flex: "1 1 40%", minWidth: "300px", height: "400px", backgroundColor: "#f8f9fa", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#adb5bd", fontSize: "24px" }}>
          Ảnh {product.name}
        </div>

        {/* Cột thông tin chi tiết */}
        <div style={{ flex: "1 1 50%", minWidth: "300px", display: "flex", flexDirection: "column" }}>
          <h2 style={{ fontSize: "32px", marginBottom: "16px", marginTop: 0 }}>{product.name}</h2>
          <p style={{ color: "#6c757d", fontSize: "16px", marginBottom: "16px" }}>Danh mục: <strong>{product.category}</strong></p>
          <p style={{ fontSize: "28px", fontWeight: "bold", color: "#dc3545", marginBottom: "24px" }}>{product.price}</p>
          <div style={{ marginBottom: "32px", lineHeight: "1.6", color: "#495057" }}>
            <h4 style={{ marginBottom: "8px" }}>Mô tả sản phẩm:</h4>
            <p>{product.description}</p>
          </div>
          <button onClick={() => addToCart(product)} style={{ padding: "16px 32px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", fontSize: "18px", fontWeight: "bold", cursor: "pointer", width: "fit-content" }}>
            Thêm vào giỏ hàng
          </button>
        </div>
      </div>
    </main>
  );
}

export default ProductDetailPage;