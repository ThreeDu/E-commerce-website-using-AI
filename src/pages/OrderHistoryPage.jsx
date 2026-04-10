import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
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

  return (
    <main className="container page-content" style={{ padding: "0 20px" }}>
      <h2 style={{ marginBottom: "24px", fontSize: "28px" }}>Lịch sử đơn hàng của bạn</h2>
      
      {orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
          <p style={{ fontSize: "18px", marginBottom: "24px", color: "#6c757d" }}>Bạn chưa có đơn hàng nào.</p>
          <Link to="/products" style={{ padding: "12px 24px", backgroundColor: "#007bff", color: "white", textDecoration: "none", borderRadius: "4px", fontWeight: "bold" }}>Bắt đầu mua sắm</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {orders.map(order => (
            (() => {
              const statusInfo = getStatusInfo(order);

              return (
            <div key={order._id} style={{ border: "1px solid #dee2e6", borderRadius: "8px", padding: "24px", backgroundColor: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #dee2e6", paddingBottom: "16px", marginBottom: "16px" }}>
                <div>
                  <p style={{ margin: "0 0 8px 0", color: "#6c757d" }}>Mã đơn hàng: <strong style={{ color: "#343a40" }}>{order._id}</strong></p>
                  <p style={{ margin: 0, color: "#6c757d" }}>Ngày đặt: <strong>{new Date(order.createdAt).toLocaleDateString("vi-VN")}</strong></p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 8px 0", color: "#6c757d" }}>
                    Trạng thái: {" "}
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", backgroundColor: statusInfo.bg, color: statusInfo.color, fontWeight: "bold", fontSize: "12px" }}>
                      {statusInfo.label}
                    </span>
                  </p>
                  <p style={{ margin: 0, color: "#dc3545", fontSize: "20px", fontWeight: "bold" }}>{order.totalPrice.toLocaleString("vi-VN")} đ</p>
                </div>
              </div>
              
              <div>
                <h4 style={{ marginBottom: "12px", fontSize: "16px" }}>Sản phẩm:</h4>
                {order.orderItems.map((item, index) => (
                  <div key={index} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
                    <span>{item.name} <strong style={{ color: "#6c757d" }}>x{item.quantity}</strong></span>
                    <span style={{ fontWeight: "bold" }}>{(item.price * item.quantity).toLocaleString("vi-VN")} đ</span>
                  </div>
                ))}
              </div>
            </div>
              );
            })()
          ))}
        </div>
      )}
    </main>
  );
}
export default OrderHistoryPage;