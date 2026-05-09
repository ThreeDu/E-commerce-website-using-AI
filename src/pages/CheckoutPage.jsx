import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { parsePrice, formatPrice } from "../utils/priceUtils";
import { getProductImageSrc } from "../utils/productUtils";
import { verifyCoupon, createOrder, fetchMyVouchers } from "../services/orderService";
import "../css/checkout.css";

function CheckoutPage() {
  const { cart, removeSelectedItems } = useCart();
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
  const [vouchers, setVouchers] = useState([]);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

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

    const loadVouchers = async () => {
      try {
        const response = await fetchMyVouchers(auth.token);
        setVouchers(Array.isArray(response?.vouchers) ? response.vouchers : []);
      } catch (error) {
        setVouchers([]);
      }
    };
    loadVouchers();
  }, [auth?.user, auth?.token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const totalPrice = selectedItems.reduce((total, item) => {
    return total + parsePrice(item.finalPrice || item.price) * item.quantity;
  }, 0);

  const discountAmount = couponInfo?.discountAmount || 0;
  const finalTotal = Math.max(0, totalPrice - discountAmount);

  const handleApplyCoupon = async (codeToApply) => {
    setCouponError("");

    if (!auth?.token) {
      setCouponError("Vui lòng đăng nhập để sử dụng mã giảm giá.");
      return;
    }

    const rawCode = typeof codeToApply === "string" ? codeToApply : couponCode;
    const normalizedCode = String(rawCode || "").trim().toUpperCase();
    
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
                onClick={() => setIsVoucherModalOpen(true)}
                className="checkout-coupon__btn checkout-coupon__btn--outline"
                style={{ background: "#f8fbff", color: "#10375c", borderColor: "#b5ccf0" }}
              >
                Chọn mã
              </button>
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

      {isVoucherModalOpen && (
        <div className="profile-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="profile-modal-card" style={{ maxWidth: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0 }}>Chọn Mã Giảm Giá</h3>
              <button 
                type="button" 
                onClick={() => setIsVoucherModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", color: "#62728a" }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto" }}>
              {vouchers.length === 0 ? (
                <p className="empty-text">Bạn hiện chưa có mã giảm giá nào.</p>
              ) : (
                vouchers.map(v => {
                  const minRequired = Number(v.minOrderValue || 0);
                  const isEligible = totalPrice >= minRequired;
                  const missingAmount = minRequired - totalPrice;

                  return (
                    <div key={v.id} style={{ 
                      border: "1px dashed #10375c", 
                      borderRadius: "8px", 
                      padding: "12px", 
                      background: isEligible ? "#f8fbff" : "#f1f5f9", 
                      opacity: isEligible ? 1 : 0.7,
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center" 
                    }}>
                      <div>
                        <h4 style={{ margin: "0 0 4px", color: isEligible ? "#10375c" : "#62728a" }}>{v.code}</h4>
                        <p style={{ margin: "0", fontSize: "13px", color: "#62728a" }}>
                          Giảm {v.type === "percent" ? `${v.value}%` : `${Number(v.value).toLocaleString("vi-VN")}đ`} 
                          {minRequired > 0 && ` cho đơn từ ${minRequired.toLocaleString("vi-VN")}đ`}
                          {Number(v.maxDiscountValue) > 0 && ` (Tối đa ${Number(v.maxDiscountValue).toLocaleString("vi-VN")}đ)`}
                        </p>
                        {!isEligible && (
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#b42318", fontWeight: 600 }}>
                            Mua thêm {missingAmount.toLocaleString("vi-VN")}đ để dùng mã
                          </p>
                        )}
                        {v.endDate && isEligible && (
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#b45309" }}>
                            HSD: {new Date(v.endDate).toLocaleString("vi-VN")}
                          </p>
                        )}
                      </div>
                      <button 
                        type="button" 
                        className="primary-action" 
                        disabled={!isEligible}
                        style={{ 
                          padding: "6px 12px", 
                          fontSize: "12px",
                          background: isEligible ? "#10375c" : "#cbd5e1",
                          cursor: isEligible ? "pointer" : "not-allowed"
                        }}
                        onClick={() => {
                          setCouponCode(v.code);
                          setIsVoucherModalOpen(false);
                          handleApplyCoupon(v.code);
                        }}
                      >
                        Áp dụng
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CheckoutPage;
