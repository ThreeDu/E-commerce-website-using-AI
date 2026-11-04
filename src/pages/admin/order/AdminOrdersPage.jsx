import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useStatusMessageBridge } from "../../../hooks/useStatusMessageBridge";
import { getAdminOrderById, getAdminOrders, updateAdminOrderStatus } from "../../../services/admin/adminOrderService";
import { createAdminQuickVoucher, getAdminUserStats, updateAdminUserPoints } from "../../../services/admin/adminUserService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import { formatCurrency, formatDateTime } from "../../../utils/formatUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faReceipt, faFilter, faEye, faSearch } from "@fortawesome/free-solid-svg-icons";
import OrderDetailDrawer from "./OrderDetailDrawer";
import CustomerStatsDrawer from "./CustomerStatsDrawer";
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

  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") || 1) || 1));

  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) => {
      const orderId = String(order._id || "").toLowerCase();
      const customerName = String(order.shippingAddress?.fullName || "").toLowerCase();
      const phone = String(order.shippingAddress?.phone || "").toLowerCase();
      const address = String(order.shippingAddress?.address || "").toLowerCase();

      return (
        orderId.includes(query) ||
        customerName.includes(query) ||
        phone.includes(query) ||
        address.includes(query)
      );
    });
  }, [orders, searchQuery]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerStats, setCustomerStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  
  // Voucher quick creation states
  const [voucherValue, setVoucherValue] = useState("10");
  const [voucherMinOrder, setVoucherMinOrder] = useState("0");
  const [voucherMaxDiscount, setVoucherMaxDiscount] = useState("0");
  const [voucherExpiry, setVoucherExpiry] = useState("7");
  const [voucherCode, setVoucherCode] = useState("");
  const [creatingVoucher, setCreatingVoucher] = useState(false);

  // Points states
  const [pointsValue, setPointsValue] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [updatingPoints, setUpdatingPoints] = useState(false);

  // Order detail popup states
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState("");
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState(false);

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
      
      const updatedOrder = data.order || data;
      if (status === "confirmed" && updatedOrder?.paymentMethod === "beepay") {
        setMessage("Đơn hàng qua BeePay đã được xác nhận và thanh toán thành công.");
      } else {
        setMessage("Cập nhật trạng thái đơn hàng thành công.");
      }
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật trạng thái đơn hàng."));
    } finally {
      setUpdatingOrderId("");
    }
  };

  const handleOpenOrderDetail = async (orderId) => {
    setSelectedOrderId(orderId);
    setIsOrderDrawerOpen(true);
    setOrderDetailLoading(true);
    setOrderDetailError("");
    setOrderDetail(null);
    
    try {
      const data = await getAdminOrderById(auth.token, orderId);
      setOrderDetail(data.order || data);
    } catch (err) {
      setOrderDetailError(err.message);
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const handleViewOrderDetail = (orderId) => {
    if (!orderId) {
      return;
    }
    handleOpenOrderDetail(orderId);
  };

  const handleOpenCustomerStats = async (customerId) => {
    setSelectedCustomerId(customerId);
    setIsDrawerOpen(true);
    setStatsLoading(true);
    setStatsError("");
    setCustomerStats(null);
    
    // Reset inputs
    setVoucherValue("10");
    setVoucherMinOrder("0");
    setVoucherMaxDiscount("0");
    setVoucherExpiry("7");
    setVoucherCode("");
    setPointsValue("");
    setPointsReason("");
    
    try {
      const data = await getAdminUserStats(auth.token, customerId);
      setCustomerStats(data);
      setPointsValue(data.user?.loyaltyPoints || "0");
    } catch (err) {
      setStatsError(err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleUpdatePoints = async () => {
    if (!selectedCustomerId || pointsValue === "" || isNaN(Number(pointsValue)) || Number(pointsValue) < 0) {
      alert("Số điểm không hợp lệ.");
      return;
    }
    
    try {
      setUpdatingPoints(true);
      const data = await updateAdminUserPoints(
        auth.token,
        selectedCustomerId,
        Number(pointsValue),
        pointsReason || "Quản trị viên điều chỉnh điểm tích lũy qua thống kê"
      );
      
      setCustomerStats(prev => ({
        ...prev,
        user: { ...prev.user, loyaltyPoints: data.loyaltyPoints }
      }));
      setMessage("Cập nhật điểm tích lũy thành công.");
    } catch (err) {
      setMessage(`Không thể cập nhật điểm: ${err.message}`);
    } finally {
      setUpdatingPoints(false);
    }
  };

  const handleCreateVoucher = async () => {
    if (!selectedCustomerId || voucherValue === "" || isNaN(Number(voucherValue)) || Number(voucherValue) <= 0) {
      alert("Phần trăm giảm giá không hợp lệ.");
      return;
    }
    
    try {
      setCreatingVoucher(true);
      const data = await createAdminQuickVoucher(auth.token, selectedCustomerId, {
        code: voucherCode,
        value: Number(voucherValue),
        minOrderValue: Number(voucherMinOrder) || 0,
        maxDiscountValue: Number(voucherMaxDiscount) || 0,
        expiryDays: Number(voucherExpiry) || 7
      });
      
      setMessage(data.message || "Tạo voucher thành công!");
      setVoucherCode("");
    } catch (err) {
      setMessage(`Không thể tạo voucher: ${err.message}`);
    } finally {
      setCreatingVoucher(false);
    }
  };

  return (
    <main className="admin-page-container flex flex-col gap-6" aria-busy={loading}>
      <section className="admin-card p-6 md:p-8 flex flex-col gap-5">
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

          <div className="grid gap-2 min-w-0 md:col-span-2">
            <label htmlFor="order-search" className="text-admin-muted text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <FontAwesomeIcon icon={faSearch} className="text-admin-muted" />
              Tìm kiếm đơn hàng
            </label>
            <input
              id="order-search"
              type="text"
              placeholder="Nhập mã đơn hàng, tên khách hàng, SĐT, địa chỉ..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
            />
          </div>
        </div>

        <p className="text-admin-muted text-sm mt-1 mb-2">
          {searchQuery.trim() ? (
            <>
              Kết quả tìm kiếm: <strong className="text-admin-ink">{filteredOrders.length}</strong> / {total}
            </>
          ) : (
            <>
              Tổng đơn hàng: <strong className="text-admin-ink">{total}</strong>
            </>
          )}
        </p>

        <div className="border border-[#e2eaf4] rounded-2xl overflow-hidden bg-white w-full max-w-full shadow-xs">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse table-auto">
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
                {filteredOrders.map((order) => (
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
                      className={order.user ? "cursor-pointer group hover:bg-slate-50" : "cursor-pointer group"}
                      onClick={() => {
                        if (order.user) {
                          handleOpenCustomerStats(order.user._id);
                        } else {
                          handleViewOrderDetail(order._id);
                        }
                      }}
                      title={order.user ? "Bấm để xem thống kê & lịch sử của khách hàng này" : "Bấm để xem chi tiết đơn hàng"}
                    >
                      <div className="font-bold text-admin-ink group-hover:text-admin-primary transition-colors duration-150 flex items-center gap-1.5 flex-wrap">
                        {order.user?.name || order.shippingAddress?.fullName || "-"}
                        {order.user && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold border border-indigo-100">Thành viên</span>
                        )}
                      </div>
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
                {!loading && filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center! text-admin-muted p-6!">
                      {orders.length === 0
                        ? "Không có đơn hàng phù hợp bộ lọc."
                        : "Không tìm thấy đơn hàng nào khớp với nội dung tìm kiếm."}
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

      {/* Customer Stats Drawer (Glassmorphism) */}
      <CustomerStatsDrawer creatingVoucher={creatingVoucher} customerStats={customerStats} handleCreateVoucher={handleCreateVoucher} handleUpdatePoints={handleUpdatePoints} handleViewOrderDetail={handleViewOrderDetail} isDrawerOpen={isDrawerOpen} pointsReason={pointsReason} pointsValue={pointsValue} setIsDrawerOpen={setIsDrawerOpen} setPointsReason={setPointsReason} setPointsValue={setPointsValue} setVoucherCode={setVoucherCode} setVoucherExpiry={setVoucherExpiry} setVoucherMaxDiscount={setVoucherMaxDiscount} setVoucherMinOrder={setVoucherMinOrder} setVoucherValue={setVoucherValue} statsError={statsError} statsLoading={statsLoading} updatingPoints={updatingPoints} voucherCode={voucherCode} voucherExpiry={voucherExpiry} voucherMaxDiscount={voucherMaxDiscount} voucherMinOrder={voucherMinOrder} voucherValue={voucherValue} />

      {/* Order Detail Drawer */}
      <OrderDetailDrawer isOrderDrawerOpen={isOrderDrawerOpen} orderDetail={orderDetail} orderDetailError={orderDetailError} orderDetailLoading={orderDetailLoading} selectedOrderId={selectedOrderId} setIsOrderDrawerOpen={setIsOrderDrawerOpen} />
    </main>
  );
}

export default AdminOrdersPage;

