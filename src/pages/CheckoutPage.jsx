import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { parsePrice, formatPrice } from "../utils/priceUtils";
import { getProductImageSrc } from "../utils/productUtils";
import { verifyCoupon, createOrder, fetchMyVouchers } from "../services/orderService";
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
  const [errors, setErrors] = useState({ fullName: "", phone: "", address: "" });
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
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
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

    let isValid = true;
    const newErrors = { fullName: "", phone: "", address: "" };

    const trimmedFullName = formData.fullName.trim();
    const trimmedPhone = formData.phone.trim();
    const trimmedAddress = formData.address.trim();
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

    if (!trimmedFullName) {
      newErrors.fullName = "Vui lòng nhập họ và tên của bạn.";
      isValid = false;
    } else if (trimmedFullName.length < 2) {
      newErrors.fullName = "Họ và tên phải có ít nhất 2 ký tự.";
      isValid = false;
    }

    if (!trimmedPhone) {
      newErrors.phone = "Vui lòng nhập số điện thoại giao hàng.";
      isValid = false;
    } else if (!phoneRegex.test(trimmedPhone)) {
      newErrors.phone = "Số điện thoại không hợp lệ (ví dụ: 0912345678).";
      isValid = false;
    }

    if (!trimmedAddress) {
      newErrors.address = "Vui lòng nhập địa chỉ giao hàng chi tiết.";
      isValid = false;
    } else if (trimmedAddress.length < 10) {
      newErrors.address = "Địa chỉ giao hàng quá ngắn, vui lòng nhập chi tiết hơn (tối thiểu 10 ký tự).";
      isValid = false;
    }

    if (!isValid) {
      setErrors(newErrors);
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
      <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 text-center py-[100px] px-5">
        <h2 className="mb-4 text-2xl font-bold">Bạn chưa chọn sản phẩm để thanh toán!</h2>
        <Link to="/cart" className="text-[#4f46e5] no-underline font-bold hover:underline">Quay lại giỏ hàng</Link>
      </main>
    );
  }

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 px-5 text-[#1e293b]">
      <h2 className="mb-6 text-[28px] font-bold">Thanh toán &amp; Đặt hàng</h2>

      <div className="flex gap-8 flex-wrap">
        {/* Cột Form điền thông tin */}
        <div className="flex-[1_1_60%] min-w-[300px] bg-[#f8fafc] p-6 rounded-2xl border border-[#e2e8f0]">
          <h3 className="mb-5 text-xl font-bold text-[#1e293b]">Thông tin giao hàng</h3>
          {formError && (
            <p className="mb-4 p-2.5 rounded-xl bg-[#fff1f2] text-[#9f1239] border border-[#fecdd3]">{formError}</p>
          )}
          <form onSubmit={handlePlaceOrder} id="checkout-form" noValidate>
            <div className="grid grid-cols-2 gap-4 max-[768px]:grid-cols-1">
              <div className="mb-4">
                <label className="block mb-2 font-bold text-[#1e293b]">Họ và tên</label>
                <input type="text" name="fullName" value={formData.fullName} onChange={handleChange}
                  className={`w-full p-2.5 rounded-xl border bg-[#f9fafb] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] ${
                    errors.fullName ? "border-red-400 focus:ring-red-400/50" : "border-[#e2e8f0]"
                  }`} placeholder="Nhập họ và tên..." />
                {errors.fullName && (
                  <span className="text-red-500 text-xs font-semibold pl-1 mt-1 block animate-fade-in">
                    {errors.fullName}
                  </span>
                )}
              </div>
              <div className="mb-4">
                <label className="block mb-2 font-bold text-[#1e293b]">Số điện thoại</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                  className={`w-full p-2.5 rounded-xl border bg-[#f9fafb] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] ${
                    errors.phone ? "border-red-400 focus:ring-red-400/50" : "border-[#e2e8f0]"
                  }`} placeholder="Nhập số điện thoại..." />
                {errors.phone && (
                  <span className="text-red-500 text-xs font-semibold pl-1 mt-1 block animate-fade-in">
                    {errors.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="mb-4">
              <label className="block mb-2 font-bold text-[#1e293b]">Địa chỉ chi tiết</label>
              <textarea name="address" value={formData.address} onChange={handleChange} rows="3"
                className={`w-full p-2.5 rounded-xl border bg-[#f9fafb] text-[#1e293b] resize-y focus:outline-none focus:ring-2 focus:ring-[#4f46e5] ${
                  errors.address ? "border-red-400 focus:ring-red-400/50" : "border-[#e2e8f0]"
                }`} placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện..."></textarea>
              {errors.address && (
                <span className="text-red-500 text-xs font-semibold pl-1 mt-1 block animate-fade-in">
                  {errors.address}
                </span>
              )}
            </div>
            <div className="mb-6">
              <label className="block mb-2 font-bold text-[#1e293b]">Phương thức thanh toán</label>
              <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}
                className="w-full p-2.5 rounded-xl border border-[#e2e8f0] bg-[#f9fafb] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]">
                <option value="cod">Thanh toán khi nhận hàng (COD)</option>
                <option value="transfer">Chuyển khoản ngân hàng</option>
              </select>
            </div>
          </form>
        </div>

        {/* Cột Tóm tắt đơn hàng */}
        <div className="flex-[1_1_30%] min-w-[280px] bg-[#f8fafc] p-6 rounded-2xl border border-[#e2e8f0] h-fit">
          <h3 className="mb-5 text-xl border-b border-[#e2e8f0] pb-3 text-[#1e293b] font-bold">Đơn hàng của bạn</h3>
          <div className="mb-5 max-h-[320px] overflow-y-auto pr-2 scrollbar-subtle">
            {selectedItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 mb-3.5 text-sm leading-relaxed">
                <img
                  src={getProductImageSrc(item)}
                  alt={item.name}
                  className="w-11 h-11 object-cover rounded-[10px] border border-[#e2e8f0] bg-white shrink-0"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.svg";
                  }}
                />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[#1e293b] font-semibold truncate">{item.name}</span>
                  <span className="text-[#64748b] text-[13px]">x{item.quantity}</span>
                </div>
                <span className="font-bold text-[#e11d48] shrink-0">
                  {formatPrice(parsePrice(item.finalPrice || item.price) * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="block mb-2 font-bold text-[#1e293b] text-sm">Mã giảm giá</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="Nhập mã..."
                className="min-w-0 flex-1 p-2 px-2.5 rounded-xl border border-[#e2e8f0] bg-[#f9fafb] text-[#1e293b] text-xs focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
              />
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(true)}
                className="py-2 px-3 rounded-xl border border-[#b5ccf0] bg-[#f8fbff] text-[#10375c] font-semibold text-xs cursor-pointer hover:bg-[#eff5ff] shrink-0 whitespace-nowrap"
              >
                Chọn mã
              </button>
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={isApplyingCoupon}
                className="py-2 px-3 rounded-xl border-none bg-[#4f46e5] text-white font-bold text-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[#4338ca] shrink-0 whitespace-nowrap"
              >
                {isApplyingCoupon ? "Đang áp..." : "Áp dụng"}
              </button>
            </div>
            {couponInfo?.coupon?.code && (
              <div className="mt-2 flex items-center justify-between text-[13px] text-[#166534]">
                <span>Đã áp dụng mã: <strong>{couponInfo.coupon.code}</strong></span>
                <button type="button" onClick={handleRemoveCoupon} className="border-none bg-transparent text-[#b91c1c] cursor-pointer font-bold hover:underline text-xs">Xóa mã</button>
              </div>
            )}
            {couponError && <p className="mt-2 mb-0 text-[#b91c1c] text-xs">{couponError}</p>}
          </div>
          <div className="flex justify-between mb-4 text-base border-t border-[#e2e8f0] pt-3 leading-[1.7] text-[#334155]">
            <span>Phí vận chuyển:</span><span className="font-bold">Miễn phí</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between mb-3 text-base leading-[1.7]">
              <span>Giảm giá:</span>
              <span className="font-bold text-[#e11d48]">- {formatPrice(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between mb-6 text-xl leading-[1.6] [&>span]:font-bold">
            <span>Tổng cộng:</span>
            <span className="text-[#e11d48]">{formatPrice(finalTotal)}</span>
          </div>

          <button type="submit" form="checkout-form" className="w-full py-3.5 bg-[#4f46e5] text-white border-none rounded-xl text-base font-bold cursor-pointer transition-all duration-[180ms] hover:bg-[#4338ca] hover:-translate-y-px hover:shadow-[0_10px_22px_rgba(79,70,229,0.18)]">
            Hoàn tất đặt hàng
          </button>
        </div>
      </div>

      {isVoucherModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9999] p-5">
          <div className="bg-white rounded-2xl w-full max-w-[500px] p-6 shadow-xl border border-[#e2e8f0] animate-fade-in">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#e2e8f0]">
              <h3 className="text-xl font-bold text-[#1e293b]">Chọn Mã Giảm Giá</h3>
              <button type="button" className="border-none bg-transparent text-[#64748b] text-lg cursor-pointer hover:text-[#1e293b]" onClick={() => setIsVoucherModalOpen(false)}>
                ✕
              </button>
            </div>
            
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1 mt-4 scrollbar-subtle">
              {(() => {
                const now = new Date();
                const activeVouchers = vouchers.filter(
                  v => !v.endDate || new Date(v.endDate) >= now
                );

                if (activeVouchers.length === 0) {
                  return <p className="text-center py-6 text-[#64748b]">Bạn hiện chưa có mã giảm giá nào.</p>;
                }

                return activeVouchers.map(v => {
                  const minRequired = Number(v.minOrderValue || 0);
                  const isEligible = totalPrice >= minRequired;
                  const missingAmount = minRequired - totalPrice;

                  return (
                    <div key={v.id} className={`border border-dashed rounded-xl p-4 flex justify-between items-center transition-all ${
                      isEligible 
                        ? "border-profile-primary bg-profile-primary/10 opacity-100" 
                        : "border-[#e2e8f0] bg-[#f8fafc] opacity-70"
                    }`}>
                      <div className="flex flex-col gap-1">
                        <h4 className={`text-base font-bold m-0 ${isEligible ? "text-profile-primary" : "text-[#64748b]"}`}>{v.code}</h4>
                        <p className="text-xs text-[#64748b] m-0">
                          Giảm {v.type === "percent" ? `${v.value}%` : `${Number(v.value).toLocaleString("vi-VN")}đ`} 
                          {minRequired > 0 && ` cho đơn từ ${minRequired.toLocaleString("vi-VN")}đ`}
                          {Number(v.maxDiscountValue) > 0 && ` (Tối đa ${Number(v.maxDiscountValue).toLocaleString("vi-VN")}đ)`}
                        </p>
                        {!isEligible && (
                          <p className="text-[11px] text-[#b42318] font-semibold m-0 mt-0.5">
                            Mua thêm {missingAmount.toLocaleString("vi-VN")}đ để dùng mã
                          </p>
                        )}
                        {v.endDate && isEligible && (
                          <p className="text-[11px] text-accent-amber font-semibold m-0 mt-0.5">
                            HSD: {new Date(v.endDate).toLocaleString("vi-VN")}
                          </p>
                        )}
                      </div>
                      <button 
                        type="button" 
                        disabled={!isEligible}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          isEligible 
                            ? "bg-profile-primary text-white hover:bg-profile-primary-light cursor-pointer" 
                            : "bg-[#e2e8f0] text-[#94a3b8] cursor-not-allowed"
                        }`}
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
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default CheckoutPage;
