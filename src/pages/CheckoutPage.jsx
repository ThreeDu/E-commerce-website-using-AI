import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";

function CheckoutPage() {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();
  const { auth } = useAuth(); // Lấy thông tin đăng nhập
  const { success, error, warning } = useNotification();

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    address: "",
    paymentMethod: "cod",
  });
  const [formError, setFormError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponInfo, setCouponInfo] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  useEffect(() => {
    if (!auth?.user) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      fullName: prev.fullName || auth.user.name || "",
      phone: prev.phone || auth.user.phone || "",
      address: prev.address || auth.user.address || "",
    }));
  }, [auth?.user]);

  // Hàm xử lý thay đổi input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Chuyển đổi giá sang số để tính toán 
  const parsePrice = (price) => {
    if (typeof price === "number") return price;
    if (typeof price === "string") {
      return parseInt(price.replace(/\D/g, ""), 10) || 0;
    }
    return 0;
  };

  const formatPrice = (priceNum) => {
    return priceNum.toLocaleString("vi-VN") + " đ";
  };

  const totalPrice = cart.reduce((total, item) => {
    return total + parsePrice(item.price) * item.quantity;
  }, 0);

  const discountAmount = couponInfo?.discountAmount || 0;
  const finalTotal = Math.max(0, totalPrice - discountAmount);

  const handleApplyCoupon = async () => {
    setCouponError("");

    if (!auth?.token) {
      setCouponError("Vui lòng đăng nhập để sử dụng mã giảm giá.");
      return;
    }

    const normalizedCode = String(couponCode || "").trim().toUpperCase();
    if (!normalizedCode) {
      setCouponError("Vui lòng nhập mã giảm giá.");
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const response = await fetch(`/api/orders/coupon/${encodeURIComponent(normalizedCode)}?subtotal=${totalPrice}`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        setCouponInfo(null);
        setCouponError(data?.message || "Không thể áp dụng mã giảm giá.");
        return;
      }

      setCouponInfo(data);
      setCouponCode(data?.coupon?.code || normalizedCode);
      setCouponError("");
    } catch (error) {
      setCouponInfo(null);
      setCouponError("Không thể kết nối để áp dụng mã giảm giá.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponInfo(null);
    setCouponError("");
    setCouponCode("");
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!auth?.token) {
      warning("Vui lòng đăng nhập để đặt hàng.", { title: "Chưa đăng nhập" });
      navigate("/login");
      return;
    }

    const trimmedFullName = formData.fullName.trim();
    const trimmedPhone = formData.phone.trim();
    const trimmedAddress = formData.address.trim();
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

    if (trimmedFullName.length < 2) {
      setFormError("Họ và tên phải có ít nhất 2 ký tự.");
      return;
    }

    if (!phoneRegex.test(trimmedPhone)) {
      setFormError("Số điện thoại không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.");
      return;
    }

    if (trimmedAddress.length < 10) {
      setFormError("Địa chỉ quá ngắn, vui lòng nhập chi tiết hơn (ít nhất 10 ký tự).");
      return;
    }
    
    // Chuẩn bị dữ liệu để gửi xuống Backend
    const orderData = {
      orderItems: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: parsePrice(item.price),
        product: item.id || item._id // Đảm bảo truyền đúng ID của MongoDB
      })),
      shippingAddress: {
        fullName: trimmedFullName,
        phone: trimmedPhone,
        address: trimmedAddress,
      },
      paymentMethod: formData.paymentMethod,
      totalPrice: finalTotal,
      discountCode: couponInfo?.coupon?.code || "",
    };

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(orderData),
      });

      if (response.ok) {
        trackEvent({
          eventName: "checkout_success",
          token: auth?.token,
          metadata: {
            totalPrice: Number(finalTotal || 0),
            originalSubtotal: Number(totalPrice || 0),
            discountAmount: Number(discountAmount || 0),
            itemCount: cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
            productCount: cart.length,
            paymentMethod: String(formData.paymentMethod || ""),
            discountCode: String(couponInfo?.coupon?.code || ""),
          },
        });

        success(`Cảm ơn ${formData.fullName} đã mua sắm tại AI Shop.`, {
          title: "Đặt hàng thành công",
        });
        clearCart(); // Làm sạch giỏ hàng
        navigate("/order-history"); // Chuyển người dùng sang trang đơn hàng của tôi
      } else {
        const errorData = await response.json();
        error(errorData.message || "Không thể tạo đơn hàng mới.", {
          title: "Đặt hàng thất bại",
        });
      }
    } catch (error) {
      console.error("Lỗi khi gọi API đặt hàng:", error);
      error("Có lỗi xảy ra khi kết nối đến máy chủ.", {
        title: "Lỗi kết nối",
      });
    }
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
          {formError && (
            <p style={{ marginBottom: "16px", padding: "10px", borderRadius: "6px", backgroundColor: "#fff1f2", color: "#9f1239", border: "1px solid #fecdd3" }}>
              {formError}
            </p>
          )}
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
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>Mã giảm giá</label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Nhập mã..."
                style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ced4da" }}
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={isApplyingCoupon}
                style={{ padding: "10px 14px", borderRadius: "4px", border: "none", backgroundColor: "#212529", color: "#fff", fontWeight: "bold", cursor: isApplyingCoupon ? "not-allowed" : "pointer" }}
              >
                {isApplyingCoupon ? "Đang áp dụng..." : "Áp dụng"}
              </button>
            </div>
            {couponInfo?.coupon?.code && (
              <div style={{ marginTop: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", color: "#166534" }}>
                <span>Đã áp dụng mã: <strong>{couponInfo.coupon.code}</strong></span>
                <button type="button" onClick={handleRemoveCoupon} style={{ border: "none", background: "transparent", color: "#b91c1c", cursor: "pointer", fontWeight: "bold" }}>Xóa mã</button>
              </div>
            )}
            {couponError && <p style={{ marginTop: "8px", marginBottom: 0, color: "#b91c1c", fontSize: "13px" }}>{couponError}</p>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "16px", borderTop: "1px solid #dee2e6", paddingTop: "12px" }}>
            <span>Phí vận chuyển:</span><span style={{ fontWeight: "bold" }}>Miễn phí</span>
          </div>
          {discountAmount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "16px" }}>
              <span>Giảm giá:</span>
              <span style={{ fontWeight: "bold", color: "#16a34a" }}>- {formatPrice(discountAmount)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", fontSize: "20px" }}>
            <span style={{ fontWeight: "bold" }}>Tổng cộng:</span>
            <span style={{ fontWeight: "bold", color: "#dc3545" }}>{formatPrice(finalTotal)}</span>
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
