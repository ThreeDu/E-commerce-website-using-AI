import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getStatusInfo } from "../utils/orderStatusUtils";
import { fetchMyOrders } from "../services/orderService";
import "../css/shop-experience.css";
import "../css/order.css";

function OrderHistoryPage() {
  const { auth } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth?.token) {
      const loadOrders = async () => {
        try {
          const data = await fetchMyOrders(auth.token);
          setOrders(data);
        } catch (error) {
          console.error("Lỗi khi tải lịch sử đơn hàng:", error);
        } finally {
          setLoading(false);
        }
      };
      loadOrders();
    }
  }, [auth]);

  // Nếu chưa đăng nhập thì đẩy về trang Login
  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <main className="container page-content order-loading"><h2>Đang tải dữ liệu...</h2></main>;
  }

  const totalSpend = orders.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const deliveredCount = orders.filter((item) => String(item.status || "") === "delivered").length;

  return (
    <main className="container page-content">
      <div className="shopx-page">
        <div className="shopx-panel shopx-hero" style={{ marginBottom: "14px" }}>
          <div>
            <h1 className="shopx-title">Lịch sử đơn hàng</h1>
            <p className="shopx-subtitle">Theo dõi trạng thái, tổng chi tiêu và quay lại đơn hàng để thao tác nhanh.</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="shopx-empty">
            <p>Bạn chưa có đơn hàng nào.</p>
            <Link to="/products" className="shopx-btn shopx-btn--primary" style={{ display: "inline-block", textDecoration: "none", marginTop: "10px" }}>
              Bắt đầu mua sắm
            </Link>
          </div>
        ) : (
          <>
            <div className="shopx-order-summary">
              <div className="shopx-panel">
                <strong>Tổng đơn</strong>
                <p className="order-history__stat-value">{orders.length}</p>
              </div>
              <div className="shopx-panel">
                <strong>Đã giao thành công</strong>
                <p className="order-history__stat-value">{deliveredCount}</p>
              </div>
              <div className="shopx-panel">
                <strong>Tổng chi tiêu</strong>
                <p className="order-history__stat-value">
                  {totalSpend.toLocaleString("vi-VN")} đ
                </p>
              </div>
            </div>

            {orders.map((order) => {
              const statusInfo = getStatusInfo(order);

              return (
                <Link
                  key={order._id}
                  to={`/order-history/${order._id}`}
                  className="shopx-order-item shopx-order-item--link"
                >
                  <div className="shopx-order-head">
                    <div>
                      <p className="order-history__meta">
                        Mã đơn: <strong>{order._id}</strong>
                      </p>
                      <p className="order-history__meta--last">
                        Ngày đặt: <strong>{new Date(order.createdAt).toLocaleDateString("vi-VN")}</strong>
                      </p>
                    </div>
                    <div className="order-history__status-col">
                      <span className="shopx-status" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                      <p className="shopx-order-total">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</p>
                    </div>
                  </div>

                  <div className="order-history__items-grid">
                    {(order.orderItems || []).map((item, index) => (
                      <div key={`${item.name}-${index}`} className="order-history__line-item">
                        <span>
                          {item.name} <strong className="order-history__line-item-qty">x{item.quantity}</strong>
                        </span>
                        <strong>{Number(item.price * item.quantity).toLocaleString("vi-VN")} đ</strong>
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
export default OrderHistoryPage;