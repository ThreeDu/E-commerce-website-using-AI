import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAdminOrderById, getAdminOrders, updateAdminOrderStatus } from "../../services/admin/orderService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import "../../css/admin/products.css";

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "shipping", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
  { value: "cancelled", label: "Đã hủy" },
];

function AdminOrdersPage() {
  const { auth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);

  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") || 1) || 1));

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (statusFilter !== "all") {
      nextParams.set("status", statusFilter);
    }

    if (page > 1) {
      nextParams.set("page", String(page));
    }

    setSearchParams(nextParams, { replace: true });
  }, [statusFilter, page, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const loadOrders = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminOrders(auth.token, {
        status: statusFilter,
        page,
        limit: 20,
      });

      setOrders(data.orders || []);
      setTotal(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.totalPages || 1)));
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể tải danh sách đơn hàng."));
    } finally {
      setLoading(false);
    }
  }, [auth?.token, statusFilter, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const formatCurrency = useCallback((value) => {
    const amount = Number(value || 0);
    return `${amount.toLocaleString("vi-VN")} đ`;
  }, []);

  const formatDateTime = useCallback((value) => {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleString("vi-VN");
  }, []);

  const statusClassByValue = useMemo(
    () => ({
      pending: "pending",
      confirmed: "confirmed",
      shipping: "shipping",
      delivered: "delivered",
      cancelled: "cancelled",
    }),
    []
  );

  const handleChangeOrderStatus = async (orderId, status) => {
    if (!orderId || !status) {
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      const data = await updateAdminOrderStatus(auth.token, orderId, status);
      setOrders((prev) =>
        prev.map((order) => (order._id === orderId ? { ...order, ...data.order } : order))
      );
      setMessage("Cập nhật trạng thái đơn hàng thành công.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật trạng thái đơn hàng."));
    } finally {
      setUpdatingOrderId("");
    }
  };

  const handleViewOrderDetail = async (orderId) => {
    if (!orderId) {
      return;
    }

    try {
      setLoadingOrderDetail(true);
      const data = await getAdminOrderById(auth.token, orderId);
      setSelectedOrder(data.order || null);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể lấy chi tiết đơn hàng."));
    } finally {
      setLoadingOrderDetail(false);
    }
  };

  return (
    <main className="container page-content">
      <section className="hero-card dashboard-surface" aria-busy={loading}>
        <div className="dashboard-header-row">
          <div>
            <h2>Quản lý đơn hàng</h2>
            <p className="dashboard-subtitle">Theo dõi và cập nhật trạng thái đơn hàng theo thời gian thực.</p>
          </div>
        </div>

        {message && (
          <p className="form-message" role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div className="dashboard-filter-bar">
          <div className="filter-control">
            <label htmlFor="order-status">Trạng thái đơn hàng</label>
            <select
              id="order-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="dashboard-subtitle">Tổng đơn hàng: {total}</p>

        <div className="dashboard-table-card">
          <div className="users-table-wrap">
            <table className="users-table admin-orders-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Thời gian</th>
                  <th>Số SP</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="order-id-cell">
                      <div className="cell-title" title={order._id}>
                        {order._id}
                      </div>
                    </td>
                    <td className="order-customer-cell">
                      <div className="cell-title">{order.user?.name || order.shippingAddress?.fullName || "-"}</div>
                      <div className="cell-subtext">{order.user?.email || "Khách vãng lai"}</div>
                    </td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>{Array.isArray(order.orderItems) ? order.orderItems.length : 0}</td>
                    <td>{formatCurrency(order.totalPrice)}</td>
                    <td>
                      <select
                        className={`table-select order-status-select ${statusClassByValue[order.status || "pending"] || "pending"}`}
                        value={order.status || "pending"}
                        onChange={(event) => handleChangeOrderStatus(order._id, event.target.value)}
                        disabled={updatingOrderId === order._id}
                      >
                        {STATUS_OPTIONS.filter((item) => item.value !== "all").map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-link-btn"
                        onClick={() => handleViewOrderDetail(order._id)}
                        disabled={loadingOrderDetail}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan="7" className="table-empty-cell">
                      Không có đơn hàng phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dashboard-pagination">
          <p>
            Trang {page}/{totalPages}
          </p>
          <div className="pagination-actions">
            <button
              type="button"
              className="secondary-btn"
              disabled={loading || page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Trước
            </button>
            <button
              type="button"
              className="secondary-btn"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Sau
            </button>
          </div>
        </div>
      </section>

      {selectedOrder && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal order-detail-modal" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
            <h3 id="order-detail-title">Chi tiết đơn hàng</h3>

            <p>
              <strong>Mã đơn:</strong> {selectedOrder._id}
            </p>
            <p>
              <strong>Khách hàng:</strong> {selectedOrder.user?.name || selectedOrder.shippingAddress?.fullName || "-"}
            </p>
            <p>
              <strong>Email:</strong> {selectedOrder.user?.email || "Khách vãng lai"}
            </p>
            <p>
              <strong>Số điện thoại:</strong> {selectedOrder.shippingAddress?.phone || "-"}
            </p>
            <p>
              <strong>Địa chỉ:</strong> {selectedOrder.shippingAddress?.address || "-"}
            </p>
            <p>
              <strong>Tổng tiền:</strong> {formatCurrency(selectedOrder.totalPrice)}
            </p>

            <div className="order-detail-items">
              <h4>Danh sách sản phẩm</h4>
              {(selectedOrder.orderItems || []).map((item, index) => (
                <div key={`${item.product || item.name}-${index}`} className="order-detail-item-row">
                  <span>
                    {item.name} x{item.quantity}
                  </span>
                  <span>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</span>
                </div>
              ))}
            </div>

            <div className="confirm-modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setSelectedOrder(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminOrdersPage;
