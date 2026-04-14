import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function getStatusInfo(order) {
  const status = String(order?.status || "").trim() || (order?.isDelivered ? "delivered" : "pending");

  if (status === "delivered") {
    return { label: "Đã giao", bg: "#dcfce7", color: "#166534" };
  }

  if (status === "shipping") {
    return { label: "Đang giao", bg: "#dbeafe", color: "#1d4ed8" };
  }

  if (status === "confirmed") {
    return { label: "Đã xác nhận", bg: "#fef3c7", color: "#b45309" };
  }

  if (status === "cancelled") {
    return { label: "Đã hủy", bg: "#fee2e2", color: "#b91c1c" };
  }

  return { label: "Chờ xử lý", bg: "#ede9fe", color: "#5b21b6" };
}

function getProductImageSrc(product) {
  const rawValue = String(product?.image || product?.imageUrl || "").trim();
  if (!rawValue) {
    return "/placeholder.jpg";
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

function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);

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
        const response = await fetch(`/api/orders/my-orders/${id}`, {
          headers: {
            Authorization: `Bearer ${auth.token}`,
          },
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data?.message || "Không thể tải chi tiết đơn hàng.");
          return;
        }

        setOrder(data);
      } catch (fetchError) {
        setError("Không thể kết nối tới máy chủ.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetail();
  }, [auth?.token, id]);

  const handleCancelOrder = async () => {
    const trimmedReason = cancelReason.trim();
    if (trimmedReason.length < 5) {
      setCancelError("Vui lòng nhập lý do hủy tối thiểu 5 ký tự.");
      return;
    }

    setCancelling(true);
    setCancelError("");
    try {
      const response = await fetch(`/api/orders/my-orders/${id}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ reason: trimmedReason }),
      });

      const data = await response.json();
      if (!response.ok) {
        setCancelError(data?.message || "Không thể hủy đơn hàng.");
        return;
      }

      setOrder(data.order);
      setShowCancelModal(false);
      setCancelReason("");
    } catch (submitError) {
      setCancelError("Không thể kết nối tới máy chủ.");
    } finally {
      setCancelling(false);
    }
  };

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <main className="container page-content" style={{ textAlign: "center", padding: "100px 20px" }}><h2>Đang tải chi tiết đơn hàng...</h2></main>;
  }

  if (!order) {
    return (
      <main className="container page-content" style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2 style={{ marginBottom: "12px" }}>Không tìm thấy đơn hàng</h2>
        <p style={{ color: "#6c757d", marginBottom: "16px" }}>{error || "Đơn hàng có thể đã bị xóa hoặc bạn không có quyền truy cập."}</p>
        <button
          type="button"
          onClick={() => navigate("/order-history")}
          style={{ padding: "10px 16px", border: "none", borderRadius: "6px", backgroundColor: "#0f172a", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
        >
          Quay lại lịch sử đơn
        </button>
      </main>
    );
  }

  const statusInfo = getStatusInfo(order);

  return (
    <main className="container page-content" style={{ padding: "0 20px" }}>
      <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "28px" }}>Chi tiết đơn hàng</h2>
        <Link to="/order-history" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "bold" }}>
          ← Quay lại lịch sử đơn
        </Link>
      </div>

      <section style={{ border: "1px solid #dee2e6", borderRadius: "10px", backgroundColor: "#fff", padding: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: "0 0 10px", color: "#6b7280" }}>Mã đơn: <strong style={{ color: "#111827" }}>{order._id}</strong></p>
            <p style={{ margin: "0 0 10px", color: "#6b7280" }}>Ngày đặt: <strong>{new Date(order.createdAt).toLocaleString("vi-VN")}</strong></p>
            <p style={{ margin: "0 0 10px", color: "#6b7280" }}>Người nhận: <strong>{order.shippingAddress?.fullName}</strong></p>
            <p style={{ margin: "0 0 10px", color: "#6b7280" }}>SĐT: <strong>{order.shippingAddress?.phone}</strong></p>
            <p style={{ margin: 0, color: "#6b7280" }}>Địa chỉ: <strong>{order.shippingAddress?.address}</strong></p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ marginTop: 0, marginBottom: "10px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: "999px", backgroundColor: statusInfo.bg, color: statusInfo.color, fontWeight: "bold", fontSize: "12px" }}>
                {statusInfo.label}
              </span>
            </p>
            <p style={{ margin: "0 0 10px", color: "#6b7280" }}>Phương thức thanh toán: <strong>{order.paymentMethod === "transfer" ? "Chuyển khoản" : "COD"}</strong></p>
            {order.discountCode ? (
              <p style={{ margin: "0 0 10px", color: "#16a34a", fontWeight: "bold" }}>Mã giảm: {order.discountCode}</p>
            ) : null}
            <p style={{ margin: 0, fontSize: "24px", color: "#dc2626", fontWeight: "bold" }}>{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</p>
          </div>
        </div>
      </section>

      <section style={{ border: "1px solid #dee2e6", borderRadius: "10px", backgroundColor: "#fff", padding: "20px" }}>
        <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Sản phẩm trong đơn</h3>
        <div style={{ display: "grid", gap: "12px" }}>
          {(order.orderItems || []).map((item, index) => {
            const product = item.product || {};
            return (
              <div key={`${item.product?._id || item.name}-${index}`} style={{ display: "grid", gridTemplateColumns: "76px 1fr auto", gap: "12px", alignItems: "center", border: "1px solid #f1f5f9", borderRadius: "8px", padding: "10px" }}>
                <img
                  src={getProductImageSrc(product)}
                  alt={item.name}
                  style={{ width: "76px", height: "76px", objectFit: "cover", borderRadius: "6px", backgroundColor: "#f8fafc" }}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.jpg";
                  }}
                />
                <div>
                  {product?._id ? (
                    <Link to={`/products/${product._id}`} style={{ color: "#111827", textDecoration: "none", fontWeight: "bold" }}>
                      {item.name}
                    </Link>
                  ) : (
                    <p style={{ margin: 0, color: "#111827", fontWeight: "bold" }}>{item.name}</p>
                  )}
                  <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                    Số lượng: {item.quantity} • Đơn giá: {Number(item.price || 0).toLocaleString("vi-VN")} đ
                  </p>
                </div>
                <strong style={{ color: "#111827" }}>{Number(item.price * item.quantity).toLocaleString("vi-VN")} đ</strong>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "18px", borderTop: "1px solid #e5e7eb", paddingTop: "12px", fontSize: "15px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span>Tạm tính</span>
            <span>{Number(order.subtotalPrice || order.totalPrice || 0).toLocaleString("vi-VN")} đ</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "#16a34a" }}>
            <span>Giảm giá</span>
            <span>- {Number(order.discountAmount || 0).toLocaleString("vi-VN")} đ</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "18px" }}>
            <span>Tổng thanh toán</span>
            <span style={{ color: "#dc2626" }}>{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</span>
          </div>
        </div>

        {order.status === "cancelled" && order.cancelledReason ? (
          <p style={{ marginTop: "14px", marginBottom: 0, color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px" }}>
            Lý do hủy: {order.cancelledReason}
          </p>
        ) : null}

        {cancellable ? (
          <div style={{ marginTop: "16px", textAlign: "right" }}>
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              style={{ padding: "10px 14px", borderRadius: "6px", border: "none", backgroundColor: "#b91c1c", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
            >
              Hủy đơn hàng
            </button>
          </div>
        ) : null}
      </section>

      {showCancelModal ? (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ width: "100%", maxWidth: "460px", backgroundColor: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Xác nhận hủy đơn hàng</h3>
            <p style={{ marginTop: 0, color: "#6b7280" }}>Vui lòng cho biết lý do hủy để hệ thống hỗ trợ tốt hơn.</p>
            <textarea
              rows={4}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Nhập lý do hủy đơn..."
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px", resize: "vertical" }}
            />
            {cancelError ? <p style={{ color: "#b91c1c", marginBottom: 0 }}>{cancelError}</p> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason("");
                  setCancelError("");
                }}
                style={{ padding: "10px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#fff", color: "#111827", fontWeight: "bold", cursor: "pointer" }}
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelOrder}
                style={{ padding: "10px 14px", borderRadius: "6px", border: "none", backgroundColor: "#b91c1c", color: "#fff", fontWeight: "bold", cursor: cancelling ? "not-allowed" : "pointer" }}
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
