import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import { getAdminOrders, updateAdminOrderStatus } from "../../services/admin/orderService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import { getStatusInfo } from "../../utils/orderStatusUtils";
import { getProductImageSrc } from "../../utils/productUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faReceipt, faFilter, faEye, faTimes, faUser, faEnvelope, faCoins, faGift, faExternalLink, faSearch } from "@fortawesome/free-solid-svg-icons";
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
      const response = await fetch(`/api/auth/admin/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Không thể lấy chi tiết đơn hàng");
      }
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
      const response = await fetch(`/api/auth/admin/users/${customerId}/stats`, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Không thể lấy thông tin khách hàng");
      }
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
      const response = await fetch(`/api/auth/admin/users/${selectedCustomerId}/points`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          points: Number(pointsValue),
          reason: pointsReason || "Quản trị viên điều chỉnh điểm tích lũy qua thống kê"
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Lỗi cập nhật điểm");
      }
      
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
      const response = await fetch(`/api/auth/admin/users/${selectedCustomerId}/quick-voucher`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          code: voucherCode,
          value: Number(voucherValue),
          minOrderValue: Number(voucherMinOrder) || 0,
          maxDiscountValue: Number(voucherMaxDiscount) || 0,
          expiryDays: Number(voucherExpiry) || 7
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Lỗi tạo voucher");
      }
      
      setMessage(data.message || "Tạo voucher thành công!");
      setVoucherCode("");
    } catch (err) {
      setMessage(`Không thể tạo voucher: ${err.message}`);
    } finally {
      setCreatingVoucher(false);
    }
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
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 transition-opacity duration-300" 
            onClick={() => setIsDrawerOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div 
            className="relative w-full max-w-[620px] max-h-[85vh] bg-white border border-slate-200 shadow-2xl flex flex-col rounded-3xl z-10 overflow-hidden animate-slide-up"
          >

              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <FontAwesomeIcon icon={faUser} />
                  </div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-800">Thống kê & Lịch sử</h3>
                    <p className="m-0 text-xs text-slate-500 font-medium">Chi tiết thông tin khách hàng và lịch sử đơn hàng</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
                {statsLoading ? (
                  <div className="py-20 text-center text-slate-500 font-medium space-y-2">
                    <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p>Đang tải dữ liệu thống kê khách hàng...</p>
                  </div>
                ) : statsError ? (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                    {statsError}
                  </div>
                ) : customerStats ? (
                  <>
                    {/* User profile brief card */}
                    <div className="p-4 bg-gradient-to-br from-indigo-50/40 to-slate-50/40 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-base truncate">{customerStats.user?.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 truncate">
                          <FontAwesomeIcon icon={faEnvelope} /> {customerStats.user?.email}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 font-medium">
                          Gia nhập: {new Date(customerStats.user?.createdAt).toLocaleDateString("vi-VN")}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Hạng thành viên</div>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1.5 border ${
                          customerStats.rank === "Kim Cương" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          customerStats.rank === "Vàng" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          customerStats.rank === "Bạc" ? "bg-slate-100 text-slate-700 border-slate-300" :
                          "bg-orange-50 text-orange-700 border-orange-200"
                        }`}>
                          {customerStats.rank}
                        </span>
                      </div>
                    </div>

                    {/* User activity metadata */}
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50/50 border border-slate-200/60 rounded-xl p-3 shadow-xs">
                      <div className="space-y-1">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Truy cập gần nhất</span>
                        <strong className="text-slate-700 block font-semibold">
                          {customerStats.lastVisit ? formatDateTime(customerStats.lastVisit) : "Chưa ghi nhận"}
                        </strong>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Đặt hàng gần nhất</span>
                        <strong className="text-slate-700 block font-semibold">
                          {customerStats.lastOrderDate ? formatDateTime(customerStats.lastOrderDate) : "Chưa có đơn hàng"}
                        </strong>
                      </div>
                      {customerStats.lastPurchaseDate && customerStats.lastPurchaseDate !== customerStats.lastOrderDate && (
                        <div className="col-span-2 pt-2 border-t border-slate-100 space-y-1">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Mua thành công gần nhất</span>
                          <strong className="text-emerald-600 block font-semibold">
                            {formatDateTime(customerStats.lastPurchaseDate)}
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Stats metric cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Truy cập tuần</span>
                        <strong className="text-slate-800 text-xl font-black">{customerStats.weeklyVisits}</strong>
                      </div>
                      <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tổng chi tiêu</span>
                        <strong className="text-red-600 text-[15px] font-black truncate">{formatCurrency(customerStats.totalSpent)}</strong>
                      </div>
                      <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Đơn hàng</span>
                        <strong className="text-slate-800 text-xl font-black">{customerStats.totalOrders}</strong>
                      </div>
                    </div>

                    {/* Quick Voucher Creator */}
                    <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-4">
                      <div className="flex items-center gap-1.5 text-indigo-600">
                        <FontAwesomeIcon icon={faGift} className="text-sm" />
                        <h4 className="m-0 text-sm font-bold text-slate-800">Tặng Voucher khuyến khích mua sắm</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="grid gap-1">
                          <label className="text-slate-500 font-bold uppercase tracking-wider">Phần trăm giảm (%)</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="100" 
                            value={voucherValue}
                            onChange={(e) => setVoucherValue(e.target.value)}
                            className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-slate-500 font-bold uppercase tracking-wider">Hạn sử dụng (Ngày)</label>
                          <input 
                            type="number" 
                            min="1" 
                            value={voucherExpiry}
                            onChange={(e) => setVoucherExpiry(e.target.value)}
                            className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-slate-500 font-bold uppercase tracking-wider">Giảm tối đa (đ)</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={voucherMaxDiscount}
                            onChange={(e) => setVoucherMaxDiscount(e.target.value)}
                            className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                            placeholder="0 = Không giới hạn"
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-slate-500 font-bold uppercase tracking-wider">Đơn tối thiểu (đ)</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={voucherMinOrder}
                            onChange={(e) => setVoucherMinOrder(e.target.value)}
                            className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="grid gap-1 text-xs">
                        <label className="text-slate-500 font-bold uppercase tracking-wider">Mã Voucher (Tùy chọn)</label>
                        <input 
                          type="text" 
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value)}
                          placeholder="Mặc định: Tự sinh mã ngẫu nhiên"
                          className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500 uppercase"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateVoucher}
                        disabled={creatingVoucher}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        {creatingVoucher ? "Đang tạo..." : "Tạo và gửi Voucher"}
                      </button>
                    </div>

                    {/* Points Adjustment tool */}
                    <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-4">
                      <div className="flex items-center gap-1.5 text-amber-600">
                        <FontAwesomeIcon icon={faCoins} className="text-sm" />
                        <h4 className="m-0 text-sm font-bold text-slate-800">Điều chỉnh điểm tích lũy</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="grid gap-1">
                          <label className="text-slate-500 font-bold uppercase tracking-wider">Tổng số điểm mới</label>
                          <input 
                            type="number" 
                            min="0" 
                            value={pointsValue}
                            onChange={(e) => setPointsValue(e.target.value)}
                            className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="grid gap-1">
                          <label className="text-slate-500 font-bold uppercase tracking-wider">Lý do điều chỉnh</label>
                          <input 
                            type="text" 
                            value={pointsReason}
                            onChange={(e) => setPointsReason(e.target.value)}
                            placeholder="Nhập lý do điều chỉnh..."
                            className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleUpdatePoints}
                        disabled={updatingPoints}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        {updatingPoints ? "Đang cập nhật..." : "Cập nhật số điểm"}
                      </button>
                    </div>

                    {/* Order History Table */}
                    <div className="space-y-3">
                      <h4 className="m-0 text-sm font-bold text-slate-800">Lịch sử đơn hàng của khách hàng</h4>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs table-fixed">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr className="text-slate-500 [&>th]:p-2 [&>th]:font-bold [&>th]:text-[10px] [&>th]:uppercase">
                              <th className="w-[35%]">Mã đơn</th>
                              <th className="w-[35%]">Tổng tiền</th>
                              <th className="w-[30%]">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {customerStats.orders.map((o) => (
                              <tr 
                                key={o._id} 
                                className="hover:bg-slate-50/80 cursor-pointer [&>td]:p-2.5"
                                onClick={() => {
                                  handleViewOrderDetail(o._id);
                                }}
                                title="Bấm để xem chi tiết đơn hàng này"
                              >
                                <td className="font-mono font-bold text-indigo-600 truncate">
                                  <FontAwesomeIcon icon={faExternalLink} className="mr-1 text-[10px]" />
                                  {o._id}
                                </td>
                                <td className="font-bold text-slate-700">{formatCurrency(o.totalPrice)}</td>
                                <td>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    o.status === "delivered" ? "bg-green-50 text-green-700 border border-green-200" :
                                    o.status === "cancelled" ? "bg-red-50 text-red-700 border border-red-200" :
                                    o.status === "shipping" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                    "bg-purple-50 text-purple-700 border border-purple-200"
                                  }`}>
                                    {o.status === "delivered" ? "Đã giao" :
                                     o.status === "cancelled" ? "Đã hủy" :
                                     o.status === "shipping" ? "Đang giao" : "Đợi duyệt"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {customerStats.orders.length === 0 && (
                              <tr>
                                <td colSpan="3" className="text-center text-slate-400 py-6">
                                  Chưa có đơn hàng nào được đặt.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

      {/* Order Detail Drawer */}
      {isOrderDrawerOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-6" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 transition-opacity duration-300" 
            onClick={() => setIsOrderDrawerOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div 
            className="relative w-full max-w-[620px] max-h-[85vh] bg-white border border-slate-200 shadow-2xl flex flex-col rounded-3xl z-10 overflow-hidden animate-slide-up"
          >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <FontAwesomeIcon icon={faReceipt} />
                  </div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-800">Chi tiết đơn hàng</h3>
                    <p className="m-0 text-xs text-slate-500 font-medium">Mã đơn: {selectedOrderId}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOrderDrawerOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
                {orderDetailLoading ? (
                  <div className="py-20 text-center text-slate-500 font-medium space-y-2">
                    <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p>Đang tải chi tiết đơn hàng...</p>
                  </div>
                ) : orderDetailError ? (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                    {orderDetailError}
                  </div>
                ) : orderDetail ? (
                  <>
                    {/* Status and Overview */}
                    {(() => {
                      const statusInfo = getStatusInfo(orderDetail);
                      return (
                        <div className="p-4 bg-gradient-to-br from-emerald-50/40 to-slate-50/40 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-4">
                          <div>
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Trạng thái</div>
                            <span 
                              className="inline-flex items-center py-1 px-2.5 rounded-full font-bold text-xs mt-1.5"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tổng thanh toán</div>
                            <div className="text-xl font-black text-red-600 mt-1">{formatCurrency(orderDetail.totalPrice)}</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Customer Info */}
                    <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-3">
                      <h4 className="m-0 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Thông tin giao hàng</h4>
                      <div className="grid gap-2.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Người nhận:</span>
                          <strong className="text-slate-800">{orderDetail.shippingAddress?.fullName || "-"}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Số điện thoại:</span>
                          <strong className="text-slate-800">{orderDetail.shippingAddress?.phone || "-"}</strong>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-400 font-medium">Địa chỉ nhận hàng:</span>
                          <strong className="text-slate-800 block text-left mt-0.5">{orderDetail.shippingAddress?.address || "-"}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Details */}
                    <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-3">
                      <h4 className="m-0 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Thông tin đơn hàng</h4>
                      <div className="grid gap-2.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Ngày đặt hàng:</span>
                          <strong className="text-slate-800">{formatDateTime(orderDetail.createdAt)}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Phương thức thanh toán:</span>
                          <strong className="text-slate-800">
                            {orderDetail.paymentMethod === "transfer"
                              ? "Chuyển khoản (Thủ công)"
                              : orderDetail.paymentMethod === "beepay"
                              ? "Quét mã VietQR (Tự động qua BeePay)"
                              : "Thanh toán khi nhận hàng (COD)"}
                          </strong>
                        </div>
                        {orderDetail.discountCode && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Mã giảm giá đã dùng:</span>
                            <strong className="text-emerald-600 font-bold">{orderDetail.discountCode}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Products list */}
                    <div className="space-y-3">
                      <h4 className="m-0 text-sm font-bold text-slate-800">Sản phẩm trong đơn</h4>
                      <div className="space-y-2.5">
                        {(orderDetail.orderItems || []).map((item, idx) => {
                          const product = item.product || {};
                          return (
                            <div key={`${product._id || idx}-${idx}`} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3 bg-white hover:bg-slate-50/50 transition-colors">
                              <img 
                                src={getProductImageSrc(product)} 
                                alt={item.name} 
                                className="w-14 h-14 object-cover rounded-lg bg-slate-50 shrink-0 border border-slate-100"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-bold text-slate-800 block truncate leading-snug">{item.name}</span>
                                <span className="text-[11px] text-slate-400 font-medium block mt-1">
                                  Số lượng: {item.quantity} • Đơn giá: {formatCurrency(item.price)}
                                </span>
                              </div>
                              <span className="text-xs font-black text-slate-800 shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Price Breakdown */}
                    <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-3 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Tạm tính:</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(orderDetail.subtotalPrice || orderDetail.totalPrice || 0)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Giảm giá:</span>
                        <span className="font-semibold text-emerald-600">- {formatCurrency(orderDetail.discountAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-100 pt-3">
                        <span>Tổng cộng:</span>
                        <span className="text-red-600 text-base">{formatCurrency(orderDetail.totalPrice)}</span>
                      </div>
                    </div>

                    {/* Cancellation Reason if cancelled */}
                    {orderDetail.status === "cancelled" && orderDetail.cancelledReason && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                        <span className="font-bold block mb-1">Lý do hủy đơn:</span>
                        {orderDetail.cancelledReason}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
    </main>
  );
}

export default AdminOrdersPage;


