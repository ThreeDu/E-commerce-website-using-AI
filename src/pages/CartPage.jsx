import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

function getProductImageSrc(item) {
  const rawValue = String(item?.image || item?.imageUrl || "").trim();
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

function CartPage() {
  const { cart, removeFromCart, updateQuantity } = useCart();

  // Hàm chuyển đổi giá sang số để tính toán (xử lý cả chuỗi cũ và số mới từ Backend)
  const parsePrice = (price) => {
    if (typeof price === "number") return price;
    if (typeof price === "string") {
      // Xóa tất cả các ký tự không phải là số
      return parseInt(price.replace(/\D/g, ""), 10) || 0;
    }
    return 0;
  };

  // Hàm định dạng số tiền VND để hiển thị lại
  const formatPrice = (priceNum) => {
    return priceNum.toLocaleString("vi-VN") + " đ";
  };

  // Tính tổng tiền của toàn bộ giỏ hàng
  const totalPrice = cart.reduce((total, item) => {
    return total + parsePrice(item.price) * item.quantity;
  }, 0);

  return (
    <main className="container page-content" style={{ padding: "0 20px" }}>
      <h2 style={{ marginBottom: "24px", fontSize: "28px" }}>Giỏ hàng của bạn</h2>

      {cart.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🛒</div>
          <p style={{ fontSize: "18px", marginBottom: "24px", color: "#6c757d" }}>Giỏ hàng đang trống.</p>
          <Link
            to="/products"
            style={{ padding: "12px 24px", backgroundColor: "#007bff", color: "white", textDecoration: "none", borderRadius: "4px", fontWeight: "bold" }}
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
          {/* Cột danh sách sản phẩm */}
          <div style={{ flex: "1 1 60%", minWidth: "300px" }}>
            {cart.map((item) => (
              <div
                key={item.id}
                style={{ display: "flex", alignItems: "center", padding: "16px", border: "1px solid #dee2e6", borderRadius: "8px", marginBottom: "16px", backgroundColor: "#fff" }}
              >
                <img
                  src={getProductImageSrc(item)}
                  alt={item.name}
                  style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "4px", marginRight: "16px", backgroundColor: "#e9ecef" }}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.svg";
                  }}
                />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>{item.name}</h4>
                  <p style={{ margin: 0, color: "#dc3545", fontWeight: "bold" }}>{formatPrice(parsePrice(item.price))}</p>
                </div>
                
                {/* Nút cộng trừ số lượng */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginRight: "24px" }}>
                  <button 
                    onClick={() => updateQuantity(item.id, -1)} 
                    style={{ width: "32px", height: "32px", borderRadius: "4px", border: "1px solid #ced4da", backgroundColor: "#f8f9fa", cursor: "pointer", fontWeight: "bold" }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: "16px", fontWeight: "500", width: "20px", textAlign: "center" }}>{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, 1)} 
                    style={{ width: "32px", height: "32px", borderRadius: "4px", border: "1px solid #ced4da", backgroundColor: "#f8f9fa", cursor: "pointer", fontWeight: "bold" }}
                  >
                    +
                  </button>
                </div>
                
                {/* Tổng tiền của 1 sản phẩm */}
                <div style={{ width: "120px", textAlign: "right", marginRight: "24px", fontWeight: "bold" }}>
                  {formatPrice(parsePrice(item.price) * item.quantity)}
                </div>

                {/* Nút Xóa */}
                <button
                  onClick={() => removeFromCart(item.id)}
                  style={{ padding: "8px 12px", backgroundColor: "#ffeeba", color: "#dc3545", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>

          {/* Cột tóm tắt đơn hàng (Tính tổng) */}
          <div style={{ flex: "1 1 30%", minWidth: "280px", backgroundColor: "#f8f9fa", padding: "24px", borderRadius: "8px", height: "fit-content", border: "1px solid #dee2e6" }}>
            <h3 style={{ marginBottom: "24px", fontSize: "20px", borderBottom: "1px solid #dee2e6", paddingBottom: "12px" }}>
              Tóm tắt đơn hàng
            </h3>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "16px", color: "#495057" }}>
              <span>Số lượng:</span>
              <span>{cart.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", fontSize: "20px" }}>
              <span style={{ fontWeight: "bold" }}>Tổng tiền:</span>
              <span style={{ fontWeight: "bold", color: "#dc3545" }}>{formatPrice(totalPrice)}</span>
            </div>
            <Link to="/checkout" style={{ display: "block", textAlign: "center", width: "100%", boxSizing: "border-box", padding: "14px", backgroundColor: "#28a745", color: "white", textDecoration: "none", borderRadius: "4px", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>
              Tiến hành thanh toán
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

export default CartPage;