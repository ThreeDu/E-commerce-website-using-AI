import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getStatusInfo } from "../utils/orderStatusUtils";
import { fetchMyOrders } from "../services/orderService";
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
    return <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 text-center py-[100px] px-5"><h2>Đang tải dữ liệu...</h2></main>;
  }

  const totalSpend = orders.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const deliveredCount = orders.filter((item) => String(item.status || "") === "delivered").length;

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <div className="bg-gradient-to-b from-[#f8fafc] to-[#f3f7fb] rounded-shop-lg p-[30px] max-[720px]:p-[18px] max-[720px]:rounded-[20px]">
        <div className="p-6 mb-[14px] grid grid-cols-[1fr_auto] gap-4 bg-gradient-to-br from-white to-shop-soft-orange border border-shop-line rounded-shop-lg shadow-shop max-[720px]:grid-cols-1">
          <div>
            <h1 className="m-0 text-[33px] tracking-tight text-shop-ink font-black max-[720px]:text-[27px]">Lịch sử đơn hàng</h1>
            <p className="mt-2 text-shop-muted text-sm leading-[1.55]">Theo dõi trạng thái, tổng chi tiêu và quay lại đơn hàng để thao tác nhanh.</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-9 px-4.5 bg-white border border-dashed border-[rgba(0,0,0,0.12)] rounded-[20px]">
            <p className="m-0 text-shop-muted text-sm leading-[1.55]">Bạn chưa có đơn hàng nào.</p>
            <Link to="/products" className="inline-block no-underline rounded-[14px] border border-shop-line bg-white text-[#1d1d1f] px-3.5 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-70 mt-2.5">
              Bắt đầu mua sắm
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-[18px] p-[18px] bg-gradient-to-b from-white to-shop-bg rounded-[20px] border border-[rgba(148,163,184,0.18)] shadow-[0_8px_20px_rgba(15,23,42,0.05)] max-[720px]:grid-cols-1">
              <div className="p-[14px_16px] bg-white border border-[rgba(148,163,184,0.15)] rounded-[14px] shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <strong className="text-shop-ink">Tổng đơn</strong>
                <p className="mt-2 mb-0 text-2xl font-bold">{orders.length}</p>
              </div>
              <div className="p-[14px_16px] bg-white border border-[rgba(148,163,184,0.15)] rounded-[14px] shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <strong className="text-shop-ink">Đã giao thành công</strong>
                <p className="mt-2 mb-0 text-2xl font-bold">{deliveredCount}</p>
              </div>
              <div className="p-[14px_16px] bg-white border border-[rgba(148,163,184,0.15)] rounded-[14px] shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <strong className="text-shop-ink">Tổng chi tiêu</strong>
                <p className="mt-2 mb-0 text-2xl font-bold">
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
                  className="block no-underline text-inherit border border-[rgba(148,163,184,0.22)] rounded-[20px] bg-gradient-to-b from-white to-[#f8fbff] p-[22px] shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] mt-3.5 first:mt-0"
                >
                  <div className="flex justify-between items-start gap-3 flex-wrap mb-3 pb-3 border-b border-[rgba(148,163,184,0.12)]">
                    <div>
                      <p className="m-0 mb-1.5 text-[#64748b] [&>strong]:text-[#1e293b]">
                        Mã đơn: <strong>{order._id}</strong>
                      </p>
                      <p className="m-0 text-[#64748b]">
                        Ngày đặt: <strong>{new Date(order.createdAt).toLocaleDateString("vi-VN")}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-full text-xs font-bold px-[11px] py-1.5" style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                      <p className="font-black text-2xl text-[#be2f00] m-0 mt-1">{Number(order.totalPrice || 0).toLocaleString("vi-VN")} đ</p>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    {(order.orderItems || []).map((item, index) => (
                      <div key={`${item.name}-${index}`} className="flex justify-between gap-2.5 text-sm">
                        <span className="text-shop-ink">
                          {item.name} <strong className="text-[#64748b] font-bold">x{item.quantity}</strong>
                        </span>
                        <strong className="text-shop-ink font-bold">{Number(item.price * item.quantity).toLocaleString("vi-VN")} đ</strong>
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