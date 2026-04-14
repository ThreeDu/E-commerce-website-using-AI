import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../css/shop-experience.css";

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

function OrderHistoryPage() {
  const { auth } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth?.token) {
      const fetchOrders = async () => {
        try {
          const response = await fetch("/api/orders/my-orders", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${auth.token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            setOrders(data);
          }
        } catch (error) {
          console.error("Lỗi khi tải lịch sử đơn hàng:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchOrders();
    }
  }, [auth]);

  // Nếu chưa đăng nhập thì đẩy về trang Login
  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <main className="container page-content" style={{ textAlign: "center", padding: "100px 20px" }}><h2>Đang tải dữ liệu...</h2></main>;
  }

  const totalSpend = orders.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const deliveredCount = orders.filter((item) => String(item.status || "") === "delivered").length;

  return (
    <main className="container page-content">
      <div className="shopx-page">
        <div className="shopx-panel shopx-hero" style={{ marginBottom: "14px" }}>
          <div>
            <h1 className="shopx-title">Lich su don hang</h1>
            <p className="shopx-subtitle">Theo doi trang thai, tong chi tieu va quay lai don hang de thao tac nhanh.</p>
          </div>
          <div className="shopx-pills">
            <span className="shopx-pill">{orders.length} don hang</span>
            <span className="shopx-pill">{deliveredCount} da giao</span>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="shopx-empty">
            <p>Ban chua co don hang nao.</p>
            <Link to="/products" className="shopx-btn shopx-btn--primary" style={{ display: "inline-block", textDecoration: "none", marginTop: "10px" }}>
              Bat dau mua sam
            </Link>
          </div>
        ) : (
          <>
            <div className="shopx-order-summary">
              <div className="shopx-panel">
                <strong>Tong don</strong>
                <p style={{ margin: "8px 0 0", fontSize: "24px", fontWeight: 700 }}>{orders.length}</p>
              </div>
              <div className="shopx-panel">
                <strong>Da giao thanh cong</strong>
                <p style={{ margin: "8px 0 0", fontSize: "24px", fontWeight: 700 }}>{deliveredCount}</p>
              </div>
              <div className="shopx-panel">
                <strong>Tong chi tieu</strong>
                <p style={{ margin: "8px 0 0", fontSize: "24px", fontWeight: 700 }}>
                  {totalSpend.toLocaleString("vi-VN")} đ
                </p>
              </div>
            </div>

            {orders.map((order) => {
              const statusInfo = getStatusInfo(order);

              return (
                <article key={order._id} className="shopx-order-item">
                  <div className="shopx-order-head">
                    <div>
                      <p style={{ margin: "0 0 6px", color: "#64748b" }}>
                        Ma don: <strong style={{ color: "#1e293b" }}>{order._id}</strong>
                      </p>
                      <p style={{ margin: 0, color: "#64748b" }}>
                        Ngay dat: <strong>{new Date(order.createdAt).toLocaleDateString("vi-VN")}</strong>
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="shopx-status" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                      <p className="shopx-order-total">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "6px" }}>
                    {(order.orderItems || []).map((item, index) => (
                      <div key={`${item.name}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "14px" }}>
                        <span>
                          {item.name} <strong style={{ color: "#64748b" }}>x{item.quantity}</strong>
                        </span>
                        <strong>{Number(item.price * item.quantity).toLocaleString("vi-VN")} đ</strong>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "12px", textAlign: "right" }}>
                    <Link
                      to={`/order-history/${order._id}`}
                      className="shopx-btn shopx-btn--primary"
                      style={{ display: "inline-block", textDecoration: "none" }}
                    >
                      Xem chi tiet don
                    </Link>
                  </div>
                </article>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
export default OrderHistoryPage;