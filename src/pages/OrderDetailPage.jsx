import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { trackEvent } from "../services/analyticsService";
import { getStatusInfo } from "../utils/orderStatusUtils";
import { getProductImageSrc } from "../utils/productUtils";
import { cancelMyOrder } from "../services/orderService";
import "../css/order.css";

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
    return <main className="container page-content order-loading"><h2>Đang tải chi tiết đơn hàng...</h2></main>;
  }

  if (!order) {
    return (
      <main className="container page-content order-not-found">
        <h2 className="order-not-found__title">Không tìm thấy đơn hàng</h2>
        <p className="order-not-found__text">{error || "Đơn hàng có thể đã bị xóa hoặc bạn không có quyền truy cập."}</p>
        <button type="button" onClick={() => navigate(backHref)} className="order-not-found__btn">
          Quay lại danh sách đơn
        </button>
      </main>
    );
  }

  const statusInfo = getStatusInfo(order);

  return (
    <main className="container page-content order-detail">
      <div className="order-detail__header">
        <h2 className="order-detail__title">Chi tiết đơn hàng</h2>
        <Link to={backHref} className="order-detail__back-link">
          ← Quay lại danh sách đơn
        </Link>
      </div>

      <section className="order-detail__section">
        <div className="order-detail__info-grid">
          <div>
            <p className="order-detail__meta">Mã đơn: <strong>{order._id}</strong></p>
            <p className="order-detail__meta">Ngày đặt: <strong>{new Date(order.createdAt).toLocaleString("vi-VN")}</strong></p>
            <p className="order-detail__meta">Người nhận: <strong>{order.shippingAddress?.fullName}</strong></p>
            <p className="order-detail__meta">SĐT: <strong>{order.shippingAddress?.phone}</strong></p>
            <p className="order-detail__meta">Địa chỉ: <strong>{order.shippingAddress?.address}</strong></p>
          </div>
          <div className="order-detail__right">
            <p className="order-detail__status-wrap">
              <span className="order-detail__status-badge" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                {statusInfo.label}
              </span>
            </p>
            <p className="order-detail__meta">Phương thức thanh toán: <strong>{order.paymentMethod === "transfer" ? "Chuyển khoản" : "COD"}</strong></p>
            {order.discountCode ? (
              <p className="order-detail__discount-code">Mã giảm: {order.discountCode}</p>
            ) : null}
            <p className="order-detail__total-price">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</p>
          </div>
        </div>
      </section>

      <section className="order-detail__section">
        <h3 className="order-detail__items-title">Sản phẩm trong đơn</h3>
        <div className="order-detail__items-grid">
          {(order.orderItems || []).map((item, index) => {
            const product = item.product || {};
            return (
              <div key={`${item.product?._id || item.name}-${index}`} className="order-detail__item">
                <img
                  src={getProductImageSrc(product)}
                  alt={item.name}
                  className="order-detail__item-image"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.svg";
                  }}
                />
                <div>
                  {product?._id ? (
                    <Link to={`/products/${product._id}`} className="order-detail__item-name">
                      {item.name}
                    </Link>
                  ) : (
                    <p className="order-detail__item-name--text">{item.name}</p>
                  )}
                  <p className="order-detail__item-meta">
                    Số lượng: {item.quantity} • Đơn giá: {Number(item.price || 0).toLocaleString("vi-VN")} đ
                  </p>
                </div>
                <strong className="order-detail__item-total">{Number(item.price * item.quantity).toLocaleString("vi-VN")} đ</strong>
              </div>
            );
          })}
        </div>

        <div className="order-detail__price-summary">
          <div className="order-detail__price-row">
            <span>Tạm tính</span>
            <span>{Number(order.subtotalPrice || order.totalPrice || 0).toLocaleString("vi-VN")} đ</span>
          </div>
          <div className="order-detail__price-row--discount">
            <span>Giảm giá</span>
            <span>- {Number(order.discountAmount || 0).toLocaleString("vi-VN")} đ</span>
          </div>
          <div className="order-detail__price-row--total">
            <span>Tổng thanh toán</span>
            <span className="order-detail__price-total-value">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</span>
          </div>
        </div>

        {order.status === "cancelled" && order.cancelledReason ? (
          <p className="order-detail__cancel-reason">
            Lý do hủy: {order.cancelledReason}
          </p>
        ) : null}

        {!isAdminView && cancellable ? (
          <div className="order-detail__cancel-wrap">
            <button type="button" onClick={() => setShowCancelModal(true)} className="order-detail__cancel-btn">
              Hủy đơn hàng
            </button>
          </div>
        ) : null}
      </section>

      {!isAdminView && showCancelModal ? (
        <div className="order-detail__modal-backdrop">
          <div className="order-detail__modal-card">
            <h3 className="order-detail__modal-title">Xác nhận hủy đơn hàng</h3>
            <p className="order-detail__modal-text">Vui lòng cho biết lý do hủy để hệ thống hỗ trợ tốt hơn.</p>
            <textarea
              rows={4}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Nhập lý do hủy đơn..."
              className="order-detail__modal-textarea"
            />
            <div className="order-detail__modal-actions">
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                }}
                className="order-detail__modal-close"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelOrder}
                className="order-detail__modal-confirm"
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
