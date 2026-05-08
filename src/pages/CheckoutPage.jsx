import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { parsePrice, formatPrice } from "../utils/priceUtils";
import { getProductImageSrc } from "../utils/productUtils";
import { verifyCoupon, createOrder } from "../services/orderService";
import "../css/checkout.css";

function CheckoutPage() {
  const { cart, clearCart, removeSelectedItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();
  const { success, error, warning } = useNotification();

  // Get selected items from navigation state
  const selectedItems = location.state?.selectedItems || cart.filter((item) => item.selected);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const totalPrice = selectedItems.reduce((total, item) => {
    return total + parsePrice(item.finalPrice || item.price) * item.quantity;
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
      const data = await verifyCoupon(normalizedCode, totalPrice, auth.token);
      setCouponInfo(data);
      setCouponCode(data?.coupon?.code || normalizedCode);
      setCouponError("");
    } catch (err) {
      setCouponInfo(null);
      setCouponError(err?.message || "Không thể áp dụng mã giảm giá.");
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

    if (selectedItems.length === 0) {
      setFormError("Vui lòng chọn ít nhất một sản phẩm để thanh toán.");
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

    const orderData = {
      orderItems: selectedItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: parsePrice(item.finalPrice || item.price),
        product: item.id || item._id,
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
      await createOrder(orderData, auth.token);

      trackEvent({
        eventName: "checkout_success",
        token: auth?.token,
        metadata: {
          totalPrice: Number(finalTotal || 0),
          originalSubtotal: Number(totalPrice || 0),
          discountAmount: Number(discountAmount || 0),
          itemCount: selectedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
          productCount: selectedItems.length,
          paymentMethod: String(formData.paymentMethod || ""),
          discountCode: String(couponInfo?.coupon?.code || ""),
        },
      });

      success(`Cảm ơn ${formData.fullName} đã mua sắm tại Tech Shop.`, {
        title: "Đặt hàng thành công",
      });

      // Remove only selected items from cart
      removeSelectedItems();

      navigate("/order-history");
    } catch (err) {
      console.error("Lỗi khi gọi API đặt hàng:", err);
      error(err?.message || "Không thể tạo đơn hàng mới.", {
        title: "Đặt hàng thất bại",
      });
    }
  };

  // Chặn người dùng vào trang thanh toán nếu không có sản phẩm được chọn
  if (selectedItems.length === 0) {
    return (
      <main className="container page-content checkout-empty">
        <h2 className="checkout-empty__title">Bạn chưa chọn sản phẩm để thanh toán!</h2>
        <Link to="/cart" className="checkout-empty__link">Quay lại giỏ hàng</Link>
      </main>
    );
  }

  return (
    <main className="container page-content checkout-page">
      <h2 className="checkout-page__title">Thanh toán &amp; Đặt hàng</h2>

      <div className="checkout-layout">
        {/* Cột Form điền thông tin */}
        <div className="checkout-form-col">
          <h3 className="checkout-form-col__title">Thông tin giao hàng</h3>
          {formError && (
            <p className="checkout-form-error">{formError}</p>
          )}
          <form onSubmit={handlePlaceOrder} id="checkout-form">
            <div className="checkout-field-row">
              <div className="checkout-field">
                <label className="checkout-field__label">Họ và tên</label>
                <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required
                  className="checkout-field__input" placeholder="Nhập họ và tên..." />
              </div>
              <div className="checkout-field">
                <label className="checkout-field__label">Số điện thoại</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required
                  className="checkout-field__input" placeholder="Nhập số điện thoại..." />
              </div>
            </div>
            <div className="checkout-field">
              <label className="checkout-field__label">Địa chỉ chi tiết</label>
              <textarea name="address" value={formData.address} onChange={handleChange} required rows="3"
                className="checkout-field__textarea" placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện..."></textarea>
            </div>
            <div className="checkout-field--lg">
              <label className="checkout-field__label">Phương thức thanh toán</label>
              <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}
                className="checkout-field__select">
                <option value="cod">Thanh toán khi nhận hàng (COD)</option>
                <option value="transfer">Chuyển khoản ngân hàng</option>
              </select>
            </div>
          </form>
        </div>

        {/* Cột Tóm tắt đơn hàng */}
        <div className="checkout-summary">
          <h3 className="checkout-summary__title">Đơn hàng của bạn</h3>
          <div className="checkout-summary__items">
            {selectedItems.map((item) => (
              <div key={item.id} className="checkout-summary__item">
                <img
                  src={getProductImageSrc(item)}
                  alt={item.name}
                  className="checkout-summary__item-thumb"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.svg";
                  }}
                />
                <div className="checkout-summary__item-body">
                  <span className="checkout-summary__item-name">{item.name}</span>
                  <span className="checkout-summary__item-qty">x{item.quantity}</span>
                </div>
                <span className="checkout-summary__item-price">
                  {formatPrice(parsePrice(item.finalPrice || item.price) * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="checkout-coupon">
            <label className="checkout-coupon__label">Mã giảm giá</label>
            <div className="checkout-coupon__row">
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Nhập mã..."
                className="checkout-coupon__input"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={isApplyingCoupon}
                className="checkout-coupon__btn"
              >
                {isApplyingCoupon ? "Đang áp dụng..." : "Áp dụng"}
              </button>
            </div>
            {couponInfo?.coupon?.code && (
              <div className="checkout-coupon__applied">
                <span>Đã áp dụng mã: <strong>{couponInfo.coupon.code}</strong></span>
                <button type="button" onClick={handleRemoveCoupon} className="checkout-coupon__remove">Xóa mã</button>
              </div>
            )}
            {couponError && <p className="checkout-coupon__error">{couponError}</p>}
          </div>
          <div className="checkout-summary__row">
            <span>Phí vận chuyển:</span><span style={{ fontWeight: "bold" }}>Miễn phí</span>
          </div>
          {discountAmount > 0 && (
            <div className="checkout-summary__row--discount">
              <span>Giảm giá:</span>
              <span className="checkout-summary__discount-value">- {formatPrice(discountAmount)}</span>
            </div>
          )}
          <div className="checkout-summary__row--total">
            <span>Tổng cộng:</span>
            <span className="checkout-summary__total-price">{formatPrice(finalTotal)}</span>
          </div>

          <button type="submit" form="checkout-form" className="checkout-submit">
            Hoàn tất đặt hàng
          </button>
        </div>
      </div>
    </main>
  );
}

export default CheckoutPage;
