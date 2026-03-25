import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    address: "",
    paymentMethod: "cod",
  });

  // Hàm xử lý thay đổi input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Chuyển đổi chuỗi giá sang số
  const parsePrice = (priceStr) => {
    return parseInt(priceStr.replace(/\./g, "").replace(" đ", ""), 10) || 0;
  };

  const formatPrice = (priceNum) => {
    return priceNum.toLocaleString("vi-VN") + " đ";
  };

  const totalPrice = cart.reduce((total, item) => {
    return total + parsePrice(item.price) * item.quantity;
  }, 0);

  const handlePlaceOrder = (e) => {
    e.preventDefault();
    
    // Ở đây sau này bạn sẽ gọi API gửi dữ liệu đơn hàng (cart, formData) lên Backend
    // Tạm thời hiển thị alert thành công
    alert(`Đặt hàng thành công!\nCảm ơn ${formData.fullName} đã mua sắm tại AI Shop.`);
    
    clearCart(); // Làm sạch giỏ hàng
    navigate("/"); // Chuyển người dùng về trang chủ
  };

  // Chặn người dùng vào trang thanh toán nếu giỏ hàng trống
  if (cart.length === 0) {
    return (
      <main className="container page-content" style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2 style={{ marginBottom: "16px" }}>Giỏ hàng của bạn đang trống!</h2>
        <Link to="/products" style={{ color: "#007bff", textDecoration: "none", fontWeight: "bold" }}>Quay lại trang Sản phẩm</Link>
      </main>
    );
  }

  return (
    <main className="container page-content" style={{ padding: "0 20px" }}>
      <h2 style={{ marginBottom: "24px", fontSize: "28px" }}>Thanh toán & Đặt hàng</h2>

      <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
        {/* Cột Form điền thông tin */}
        <div style={{ flex: "1 1 60%", minWidth: "300px", backgroundColor: "#fff", padding: "24px", borderRadius: "8px", border: "1px solid #dee2e6" }}>
          <h3 style={{ marginBottom: "20px", fontSize: "20px" }}>Thông tin giao hàng</h3>
          <form onSubmit={handlePlaceOrder} id="checkout-form">
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Họ và tên</label>
              <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required 
                style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ced4da", boxSizing: "border-box" }} placeholder="Nhập họ và tên..." />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Số điện thoại</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required 
                style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ced4da", boxSizing: "border-box" }} placeholder="Nhập số điện thoại..." />
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Địa chỉ chi tiết</label>
              <textarea name="address" value={formData.address} onChange={handleChange} required rows="3" 
                style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ced4da", boxSizing: "border-box", resize: "vertical" }} placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện..."></textarea>
            </div>
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Phương thức thanh toán</label>
              <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} 
                style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #ced4da", boxSizing: "border-box" }}>
                <option value="cod">Thanh toán khi nhận hàng (COD)</option>
                <option value="transfer">Chuyển khoản ngân hàng</option>
              </select>
            </div>
          </form>
        </div>

        {/* Cột Tóm tắt đơn hàng */}
        <div style={{ flex: "1 1 30%", minWidth: "280px", backgroundColor: "#f8f9fa", padding: "24px", borderRadius: "8px", border: "1px solid #dee2e6", height: "fit-content" }}>
          <h3 style={{ marginBottom: "20px", fontSize: "20px", borderBottom: "1px solid #dee2e6", paddingBottom: "12px" }}>Đơn hàng của bạn</h3>
          <div style={{ marginBottom: "20px" }}>
            {cart.map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px" }}>
                <span>{item.name} <strong style={{ color: "#6c757d" }}>x{item.quantity}</strong></span>
                <span style={{ fontWeight: "bold" }}>{formatPrice(parsePrice(item.price) * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "16px", borderTop: "1px solid #dee2e6", paddingTop: "12px" }}>
            <span>Phí vận chuyển:</span><span style={{ fontWeight: "bold" }}>Miễn phí</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", fontSize: "20px" }}>
            <span style={{ fontWeight: "bold" }}>Tổng cộng:</span>
            <span style={{ fontWeight: "bold", color: "#dc3545" }}>{formatPrice(totalPrice)}</span>
          </div>
          
          <button type="submit" form="checkout-form" style={{ width: "100%", padding: "14px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>
            Hoàn tất đặt hàng
          </button>
        </div>
      </div>
    </main>
  );
}

export default CheckoutPage;
