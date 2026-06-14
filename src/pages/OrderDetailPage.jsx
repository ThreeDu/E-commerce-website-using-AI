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
            <p className="m-0 mb-2.5 text-[#6b7280] last:mb-0 [&>strong]:text-[#111827]">Phương thức thanh toán: <strong>{order.paymentMethod === "transfer" ? "Chuyển khoản" : "COD"}</strong></p>
            {order.discountCode ? (
              <p className="m-0 mb-2.5 text-[#16a34a] font-bold">Mã giảm: {order.discountCode}</p>
            ) : null}
            <p className="m-0 text-2xl text-[#dc2626] font-bold">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</p>
          </div>
        </div>
      </section>

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
