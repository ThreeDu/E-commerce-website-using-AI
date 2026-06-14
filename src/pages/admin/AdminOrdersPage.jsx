import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import { getAdminOrders, updateAdminOrderStatus } from "../../services/admin/orderService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faReceipt, faFilter, faEye } from "@fortawesome/free-solid-svg-icons";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") || 1) || 1));

  useStatusMessageBridge(message, { title: "Đơn hàng" });

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
      pending: "text-purple-800 bg-purple-50 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100",
      confirmed: "text-amber-800 bg-amber-50 border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100",
      shipping: "text-blue-800 bg-blue-50 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100",
      delivered: "text-green-800 bg-green-50 border-green-200 focus:border-green-500 focus:ring-4 focus:ring-green-100",
      cancelled: "text-red-800 bg-red-50 border-red-200 focus:border-red-500 focus:ring-4 focus:ring-red-100",
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

  const handleViewOrderDetail = (orderId) => {
    if (!orderId) {
      return;
    }

    navigate(`/admin/orders/${orderId}`);
  };

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section
        className="bg-admin-surface border border-admin-line rounded-3xl shadow-admin p-6 md:p-8 grid gap-4 animate-admin-rise bg-[radial-gradient(circle_at_88%_-8%,rgba(255,111,60,0.12),transparent_36%),radial-gradient(circle_at_-8%_100%,rgba(15,118,110,0.1),transparent_30%),#ffffff]"
        aria-busy={loading}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-admin-ink mt-0 mb-1 flex items-center gap-2.5">
              <FontAwesomeIcon icon={faReceipt} className="text-admin-primary" />
              Quản lý đơn hàng
            </h2>
            <p className="text-admin-muted mt-1.5 mb-0 text-sm md:text-base">Theo dõi và cập nhật trạng thái đơn hàng theo thời gian thực.</p>
          </div>
        </div>

        {message && (
          <p className="text-sm font-semibold text-[#0f3f84] bg-[#f0f6ff] border border-[#c6dbf7] rounded-xl p-3" role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 items-end">
          <div className="grid gap-2 min-w-0">
            <label htmlFor="order-status" className="text-admin-muted text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <FontAwesomeIcon icon={faFilter} className="text-admin-muted" />
              Trạng thái đơn hàng
            </label>
            <select
              id="order-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-admin-muted text-sm mt-1 mb-2">
          Tổng đơn hàng: <strong className="text-admin-ink">{total}</strong>
        </p>

        <div className="border border-[#e2eaf4] rounded-2xl overflow-hidden bg-white w-full max-w-full shadow-xs">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-[#f2f7ff] text-[#4a5c75] [&>th]:p-3.5 [&>th]:font-bold [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider [&>th]:border-b [&>th]:border-admin-line">
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Thời gian</th>
                  <th>Số SP</th>
                  <th>Tổng tiền</th>
                  <th className="text-center!">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {orders.map((order) => (
                  <tr key={order._id} className="transition-colors hover:bg-[#f8fbff] [&>td]:p-3.5 [&>td]:align-middle">
                    <td
                      className="cursor-pointer group"
                      onClick={() => handleViewOrderDetail(order._id)}
                      title="Bấm để xem chi tiết đơn hàng"
                    >
                      <div className="font-mono break-all font-bold text-admin-ink group-hover:text-admin-primary transition-colors duration-150" title={order._id}>
                        <FontAwesomeIcon icon={faEye} className="mr-1.5 text-admin-primary" />
                        {order._id}
                      </div>
                    </td>
                    <td
                      className="cursor-pointer group"
                      onClick={() => handleViewOrderDetail(order._id)}
                      title="Bấm để xem chi tiết đơn hàng"
                    >
                      <div className="font-bold text-admin-ink group-hover:text-admin-primary transition-colors duration-150">{order.user?.name || order.shippingAddress?.fullName || "-"}</div>
                      <div className="mt-1 text-admin-muted text-xs break-all">{order.user?.email || "Khách vãng lai"}</div>
                    </td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>{Array.isArray(order.orderItems) ? order.orderItems.length : 0}</td>
                    <td>{formatCurrency(order.totalPrice)}</td>
                    <td className="text-center!">
                      <select
                        className={`w-[132px] min-w-[132px] max-w-[132px] h-8 p-[4px_12px] text-xs font-bold text-center border rounded-lg focus:outline-none block mx-auto transition-colors duration-150 ${statusClassByValue[order.status || "pending"] || "text-admin-ink bg-white border-admin-line"}`}
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
                  </tr>
                ))}
                {!loading && orders.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center! text-admin-muted p-6!">
                      Không có đơn hàng phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3.5 p-3 flex flex-col sm:flex-row justify-between items-center gap-3 border border-[#dce5f0] rounded-xl bg-[#f8fbff]">
          <p className="m-0 text-[#4f6078] text-[13px] font-bold">
            Trang {page}/{totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <FontAwesomeIcon icon={faChevronLeft} style={{ marginRight: "6px" }} />
              Trước
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Sau
              <FontAwesomeIcon icon={faChevronRight} style={{ marginLeft: "6px" }} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AdminOrdersPage;


