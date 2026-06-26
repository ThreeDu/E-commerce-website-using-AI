import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { getStatusInfo } from "../utils/orderStatusUtils";
import { getProductImageSrc } from "../utils/productUtils";
import { cancelMyOrder } from "../services/orderService";
function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuth();
  const { success, error: notifyError, warning } = useNotification();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const isAdminView = auth?.user?.role === "admin" && location.pathname.startsWith("/admin/orders/");
  const detailEndpoint = isAdminView ? `/api/auth/admin/orders/${id}` : `/api/orders/my-orders/${id}`;
  const backHref = isAdminView ? "/admin/orders" : "/order-history";

  const cancellable = useMemo(() => {
    const status = String(order?.status || "");
    return status === "pending" || status === "confirmed";
  }, [order?.status]);

  useEffect(() => {
    const fetchOrderDetail = async () => {
      if (!auth?.token) {
        return;
      }

      try {
        setError("");
        const response = await fetch(detailEndpoint, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data?.message || "Không thể tải chi tiết đơn hàng.");
          return;
        }

        setOrder(data?.order || data || null);
      } catch (fetchError) {
        setError("Không thể kết nối tới máy chủ.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetail();
  }, [auth?.token, detailEndpoint]);

  // Tự động kiểm tra trạng thái thanh toán (polling) mỗi 5 giây
  useEffect(() => {
    if (!order || order.status !== "pending" || !auth?.token || isAdminView) {
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(detailEndpoint, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const fetchedOrder = data?.order || data;
          if (fetchedOrder && fetchedOrder.status !== "pending") {
            setOrder(fetchedOrder);
            success("Đơn hàng của bạn đã được xác nhận thanh toán thành công!", {
              title: "Thanh toán thành công",
            });
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        console.error("Lỗi khi kiểm tra trạng thái đơn hàng:", err);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [order?.status, auth?.token, detailEndpoint, isAdminView, success]);

  const handleCopyText = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    success(`Đã sao chép ${fieldName} vào bộ nhớ tạm.`, {
      title: "Sao chép thành công",
    });
  };

  const handleCancelOrder = async () => {
    if (isAdminView) {
      return;
    }

    const trimmedReason = cancelReason.trim();
    if (trimmedReason.length < 5) {
      warning("Vui lòng nhập lý do hủy tối thiểu 5 ký tự.", { title: "Hủy đơn hàng" });
      return;
    }

    setCancelling(true);
    try {
      const data = await cancelMyOrder(id, trimmedReason, auth.token);

      setOrder(data.order);
      setShowCancelModal(false);
      setCancelReason("");
      trackEvent({
        eventName: "order_cancel",
        token: auth?.token,
        metadata: {
          orderId: String(data?.order?._id || id),
          reason: trimmedReason,
          totalPrice: Number(data?.order?.totalPrice || 0),
          itemCount: Array.isArray(data?.order?.orderItems)
            ? data.order.orderItems.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
            : 0,
        },
      });
      success("Đơn hàng đã được hủy thành công.", { title: "Hủy đơn hàng" });
    } catch (submitError) {
      notifyError(submitError?.message || "Không thể kết nối tới máy chủ.", { title: "Hủy đơn hàng" });
    } finally {
      setCancelling(false);
    }
  };

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 text-center py-[100px] px-5"><h2>Đang tải chi tiết đơn hàng...</h2></main>;
  }

  if (!order) {
    return (
      <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 text-center py-[100px] px-5">
        <h2 className="mb-3 text-2xl font-bold">Không tìm thấy đơn hàng</h2>
        <p className="text-[#6c757d] mb-4">{error || "Đơn hàng có thể đã bị xóa hoặc bạn không có quyền truy cập."}</p>
        <button type="button" onClick={() => navigate(backHref)} className="py-2.5 px-4 border-none rounded-md bg-[#0f172a] text-white font-bold cursor-pointer hover:bg-[#1e293b]">
          Quay lại danh sách đơn
        </button>
      </main>
    );
  }

  const statusInfo = getStatusInfo(order);

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 px-5">
      <div className="mb-5 flex justify-between items-center flex-wrap gap-2.5">
        <h2 className="m-0 text-[28px] font-bold">Chi tiết đơn hàng</h2>
        <Link to={backHref} className="text-[#2563eb] no-underline font-bold hover:underline">
          ← Quay lại danh sách đơn
        </Link>
      </div>

      <section className="border border-[#dee2e6] rounded-[10px] bg-white p-5 mb-5">
        <div className="flex justify-between gap-4 flex-wrap">
          <div>
            <p className="m-0 mb-2.5 text-[#6b7280] last:mb-0 [&>strong]:text-[#111827]">Mã đơn: <strong>{order._id}</strong></p>
            <p className="m-0 mb-2.5 text-[#6b7280] last:mb-0 [&>strong]:text-[#111827]">Ngày đặt: <strong>{new Date(order.createdAt).toLocaleString("vi-VN")}</strong></p>
            <p className="m-0 mb-2.5 text-[#6b7280] last:mb-0 [&>strong]:text-[#111827]">Người nhận: <strong>{order.shippingAddress?.fullName}</strong></p>
            <p className="m-0 mb-2.5 text-[#6b7280] last:mb-0 [&>strong]:text-[#111827]">SĐT: <strong>{order.shippingAddress?.phone}</strong></p>
            <p className="m-0 mb-2.5 text-[#6b7280] last:mb-0 [&>strong]:text-[#111827]">Địa chỉ: <strong>{order.shippingAddress?.address}</strong></p>
          </div>
          <div className="text-right">
            <p className="mt-0 mb-2.5">
              <span className="inline-flex items-center py-1.5 px-3 rounded-full font-bold text-xs" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                {statusInfo.label}
              </span>
            </p>
            <p className="m-0 mb-2.5 text-[#6b7280] last:mb-0 [&>strong]:text-[#111827]">
              Phương thức thanh toán:{" "}
              <strong>
                {order.paymentMethod === "transfer"
                  ? "Chuyển khoản (Thủ công)"
                  : order.paymentMethod === "beepay"
                  ? "Quét mã VietQR (Tự động qua BeePay)"
                  : "COD"}
              </strong>
            </p>
            {order.isPaid ? (
              <p className="m-0 mb-2.5 text-[#16a34a] font-bold text-xs">
                ✓ Đã thanh toán ({new Date(order.paidAt).toLocaleString("vi-VN")})
              </p>
            ) : null}
            {order.discountCode ? (
              <p className="m-0 mb-2.5 text-[#16a34a] font-bold">Mã giảm: {order.discountCode}</p>
            ) : null}
            <p className="m-0 text-2xl text-[#dc2626] font-bold">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</p>
          </div>
        </div>
      </section>

      {/* Hiển thị hướng dẫn thanh toán QR VietQR nếu phương thức là chuyển khoản & trạng thái pending */}
      {!isAdminView && order.status === "pending" && order.paymentConfig ? (
        <section className="border border-[#dee2e6] rounded-[10px] bg-[#f8fafc] p-6 mb-5 shadow-sm">
          <div className="flex gap-6 items-center flex-wrap md:flex-nowrap">
            {/* Cột trái: Mã QR */}
            <div className="flex flex-col items-center bg-white p-4 rounded-xl shadow-sm border border-[#e2e8f0] mx-auto md:mx-0">
              <h4 className="text-xs font-bold text-[#475569] mb-3 text-center">Quét mã VietQR để thanh toán</h4>
              <div className="relative w-[180px] h-[180px] bg-slate-50 flex items-center justify-center rounded-lg overflow-hidden border border-[#f1f5f9]">
                <img 
                  src={order.paymentConfig.qrUrl} 
                  alt="VietQR Payment Code" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/placeholder.svg";
                  }}
                />
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#059669] font-bold animate-pulse">
                <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                Đang chờ thanh toán tự động...
              </div>
            </div>

            {/* Cột phải: Hướng dẫn chuyển khoản */}
            <div className="flex-1 w-full text-[14px]">
              <h3 className="mt-0 mb-4 text-base font-bold text-[#1e293b]">Thông tin chuyển khoản</h3>
              
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between border-b border-[#cbd5e1]/30 pb-2">
                  <span className="text-[#64748b]">Ngân hàng:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1e293b]">{order.paymentConfig.bankId}</span>
                    <button 
                      type="button" 
                      onClick={() => handleCopyText(order.paymentConfig.bankId, "Ngân hàng")}
                      className="text-xs text-[#2563eb] font-semibold border-none bg-transparent hover:underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-[#cbd5e1]/30 pb-2">
                  <span className="text-[#64748b]">Số tài khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#1e293b]">{order.paymentConfig.accountNo}</span>
                    <button 
                      type="button" 
                      onClick={() => handleCopyText(order.paymentConfig.accountNo, "Số tài khoản")}
                      className="text-xs text-[#2563eb] font-semibold border-none bg-transparent hover:underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-[#cbd5e1]/30 pb-2">
                  <span className="text-[#64748b]">Chủ tài khoản:</span>
                  <span className="font-bold text-[#1e293b]">{order.paymentConfig.accountName}</span>
                </div>

                <div className="flex items-center justify-between border-b border-[#cbd5e1]/30 pb-2">
                  <span className="text-[#64748b]">Số tiền chuyển:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#dc2626]">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</span>
                    <button 
                      type="button" 
                      onClick={() => handleCopyText(order.totalPrice.toString(), "Số tiền")}
                      className="text-xs text-[#2563eb] font-semibold border-none bg-transparent hover:underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-[#cbd5e1]/30 pb-2">
                  <span className="text-[#64748b]">Nội dung chuyển khoản:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#2563eb] bg-[#eff6ff] px-2 py-0.5 rounded border border-[#bfdbfe]">{order.paymentConfig.description}</span>
                    <button 
                      type="button" 
                      onClick={() => handleCopyText(order.paymentConfig.description, "Nội dung chuyển khoản")}
                      className="text-xs text-[#2563eb] font-semibold border-none bg-transparent hover:underline cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-[#eff6ff] text-xs text-[#1e40af] border border-[#bfdbfe]/50 leading-relaxed">
                <strong>Lưu ý quan trọng:</strong> Vui lòng chuyển <strong>chính xác số tiền</strong> và <strong>nội dung chuyển khoản</strong> ở trên (hoặc quét mã QR để điền tự động). Hệ thống sẽ tự động xác thực và cập nhật trạng thái đơn hàng của bạn ngay khi nhận được tiền.
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="border border-[#dee2e6] rounded-[10px] bg-white p-5 mb-5">
        <h3 className="mt-0 mb-4 font-bold text-lg">Sản phẩm trong đơn</h3>
        <div className="grid gap-3">
          {(order.orderItems || []).map((item, index) => {
            const product = item.product || {};
            return (
              <div key={`${item.product?._id || item.name}-${index}`} className="grid grid-cols-[76px_1fr_auto] gap-3 items-center border border-[#f1f5f9] rounded-lg p-2.5">
                <img
                  src={getProductImageSrc(product)}
                  alt={item.name}
                  className="w-[76px] h-[76px] object-cover rounded-md bg-[#f8fafc]"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.svg";
                  }}
                />
                <div>
                  {product?._id ? (
                    <Link to={`/products/${product._id}`} className="text-[#111827] no-underline font-bold hover:underline">
                      {item.name}
                    </Link>
                  ) : (
                    <p className="m-0 text-[#111827] font-bold">{item.name}</p>
                  )}
                  <p className="mt-1 mb-0 text-[#6b7280] text-sm">
                    Số lượng: {item.quantity} • Đơn giá: {Number(item.price || 0).toLocaleString("vi-VN")} đ
                  </p>
                </div>
                <strong className="text-[#111827] font-bold">{Number(item.price * item.quantity).toLocaleString("vi-VN")} đ</strong>
              </div>
            );
          })}
        </div>

        <div className="mt-[18px] border-t border-[#e5e7eb] pt-3 text-[15px]">
          <div className="flex justify-between mb-2">
            <span>Tạm tính</span>
            <span>{Number(order.subtotalPrice || order.totalPrice || 0).toLocaleString("vi-VN")} đ</span>
          </div>
          <div className="flex justify-between mb-2 text-[#16a34a]">
            <span>Giảm giá</span>
            <span>- {Number(order.discountAmount || 0).toLocaleString("vi-VN")} đ</span>
          </div>
          <div className="flex justify-between font-bold text-lg">
            <span>Tổng thanh toán</span>
            <span className="text-[#dc2626]">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</span>
          </div>
        </div>

        {order.status === "cancelled" && order.cancelledReason ? (
          <p className="mt-3.5 mb-0 text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-md p-2.5">
            Lý do hủy: {order.cancelledReason}
          </p>
        ) : null}

        {!isAdminView && cancellable ? (
          <div className="mt-4 text-right">
            <button type="button" onClick={() => setShowCancelModal(true)} className="py-2.5 px-3.5 rounded-md border-none bg-[#b91c1c] text-white font-bold cursor-pointer hover:bg-[#991b1b]">
              Hủy đơn hàng
            </button>
          </div>
        ) : null}
      </section>

      {!isAdminView && showCancelModal ? (
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.55)] flex items-center justify-center z-[1000] p-5">
          <div className="w-full max-w-[460px] bg-white rounded-xl p-5 border border-[#e2e8f0]">
            <h3 className="mt-0 mb-2.5 text-lg font-bold">Xác nhận hủy đơn hàng</h3>
            <p className="mt-0 text-[#6b7280] mb-3 text-sm">Vui lòng cho biết lý do hủy để hệ thống hỗ trợ tốt hơn.</p>
            <textarea
              rows={4}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Nhập lý do hủy đơn..."
              className="w-full border border-[#cbd5e1] rounded-lg p-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#b91c1c]"
            />
            <div className="flex justify-end gap-2 mt-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="py-2.5 px-3.5 rounded-md border border-[#cbd5e1] bg-white text-[#111827] font-bold cursor-pointer hover:bg-[#f8fafc]"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelOrder}
                className="py-2.5 px-3.5 rounded-md border-none bg-[#b91c1c] text-white font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[#991b1b]"
              >
                {cancelling ? "Đang hủy..." : "Xác nhận hủy"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default OrderDetailPage;
