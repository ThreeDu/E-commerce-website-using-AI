import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import { getAdminNotifications } from "../../services/admin/notificationService";
import { getAdminRevenueOverview } from "../../services/admin/orderService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRotate,
  faBell,
  faReceipt,
  faPlusCircle,
  faTag,
  faChevronRight,
  faTriangleExclamation,
  faBoxArchive,
  faCartPlus,
  faCircleXmark,
  faClock,
  faArrowTrendUp,
  faBoxesStacked,
  faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";

const AUTO_REFRESH_MS = 30000;

const quickActions = [
  { label: "Trung tâm thông báo", to: "/admin/notifications", icon: faBell, color: "text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200" },
  { label: "Quản lý đơn hàng", to: "/admin/orders", icon: faReceipt, color: "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200" },
  { label: "Thêm sản phẩm mới", to: "/admin/products/add", icon: faPlusCircle, color: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200" },
  { label: "Tạo mã giảm giá", to: "/admin/discounts/add", icon: faTag, color: "text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200" },
];

const PIE_COLORS = [
  "#2563eb", // blue-600
  "#0ea5e9", // sky-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#64748b", // slate-500
];

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function formatCompactCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatRelativeTime(value) {
  if (!value) return "Không rõ thời gian";
  const now = Date.now();
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return "Không rõ thời gian";

  const diffMinutes = Math.max(0, Math.floor((now - target) / 60000));
  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function getMonthLabel(monthNumber) {
  return `Tháng ${monthNumber}`;
}

function AdminDashboard() {
  const { auth } = useAuth();
  const [payload, setPayload] = useState(null);
  const [revenuePayload, setRevenuePayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const currentDate = useMemo(() => new Date(), []);
  const [periodType, setPeriodType] = useState("month");
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  useStatusMessageBridge(errorMessage, { title: "Dashboard", type: "error" });

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (!auth?.token) return;

      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        setErrorMessage("");
        const [notificationsData, revenueData] = await Promise.all([
          getAdminNotifications(auth.token),
          getAdminRevenueOverview(auth.token, {
            periodType,
            year: selectedYear,
            month: periodType === "month" ? selectedMonth : undefined,
          }),
        ]);

        setPayload(notificationsData);
        setRevenuePayload(revenueData);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Không thể tải dữ liệu dashboard."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [auth?.token, periodType, selectedYear, selectedMonth]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!auth?.token) return undefined;
    const timerId = setInterval(() => {
      loadDashboard({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timerId);
  }, [auth?.token, loadDashboard]);

  const summary = useMemo(() => payload?.summary || {}, [payload]);
  const sections = useMemo(() => payload?.sections || {}, [payload]);
  const config = useMemo(() => payload?.config || {}, [payload]);
  const revenue = useMemo(() => revenuePayload?.revenue || {}, [revenuePayload]);
  const revenueFilter = useMemo(() => revenue?.filter || {}, [revenue]);

  const availableYears = useMemo(() => {
    if (Array.isArray(revenueFilter.availableYears) && revenueFilter.availableYears.length > 0) {
      return revenueFilter.availableYears;
    }
    return [currentDate.getFullYear()];
  }, [revenueFilter, currentDate]);

  const yearOptions = useMemo(() => {
    const merged = new Set([...availableYears, Number(selectedYear)]);
    return Array.from(merged)
      .filter((value) => Number.isInteger(value) && value >= 2000)
      .sort((a, b) => b - a);
  }, [availableYears, selectedYear]);

  const productBreakdown = useMemo(
    () => (Array.isArray(revenue?.products?.breakdown) ? revenue.products.breakdown : []),
    [revenue]
  );

  const totalSoldUnits = useMemo(
    () => Number(revenue?.products?.totalSoldUnits || 0),
    [revenue]
  );

  const pieSlices = useMemo(() => {
    if (totalSoldUnits <= 0 || productBreakdown.length === 0) {
      return [];
    }

    let cursor = 0;
    return productBreakdown.map((item, index) => {
      const soldQuantity = Number(item?.soldQuantity || 0);
      const percent = (soldQuantity / totalSoldUnits) * 100;
      const start = cursor;
      const end = cursor + percent;
      cursor = end;

      return {
        ...item,
        color: PIE_COLORS[index % PIE_COLORS.length],
        percent,
        start,
        end,
      };
    });
  }, [productBreakdown, totalSoldUnits]);

  const pieBackground = useMemo(() => {
    if (pieSlices.length === 0) {
      return "conic-gradient(#e2e8f0 0 100%)";
    }

    return `conic-gradient(${pieSlices
      .map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`)
      .join(", ")})`;
  }, [pieSlices]);

  const metrics = useMemo(
    () => [
      {
        label: "Đơn hàng mới",
        value: Number(summary.newOrders || 0),
        trend: `Trong ${Number(config.recentWindowHours || 24)}h gần nhất`,
        icon: faCartPlus,
        colorClass: "bg-blue-50 text-blue-600 border-blue-100",
        badgeClass: "bg-blue-100 text-blue-700",
        accent: "text-blue-600",
      },
      {
        label: "Đơn bị hủy",
        value: Number(summary.cancelledOrders || 0),
        trend: "Cần kiểm tra lý do",
        icon: faCircleXmark,
        colorClass: "bg-rose-50 text-rose-600 border-rose-100",
        badgeClass: "bg-rose-100 text-rose-700",
        accent: "text-rose-600",
      },
      {
        label: "Sản phẩm sắp hết",
        value: Number(summary.lowStockProducts || 0),
        trend: `Ngưỡng báo <= ${Number(config.lowStockThreshold || 5)} sản phẩm`,
        icon: faTriangleExclamation,
        colorClass: "bg-amber-50 text-amber-600 border-amber-100",
        badgeClass: "bg-amber-100 text-amber-700",
        accent: "text-amber-600",
      },
      {
        label: "Sản phẩm hết hàng",
        value: Number(summary.outOfStockProducts || 0),
        trend: "Ưu tiên nhập kho bổ sung",
        icon: faBoxArchive,
        colorClass: "bg-red-50 text-red-600 border-red-100",
        badgeClass: "bg-red-100 text-red-700",
        accent: "text-red-600",
      },
    ],
    [summary, config]
  );

  const alerts = useMemo(() => {
    const nextAlerts = [];

    if (Number(summary.newOrders || 0) > 0) {
      nextAlerts.push({
        key: "new-orders",
        title: `${summary.newOrders} đơn hàng mới`,
        description: "Đơn mới phát sinh gần đây, cần xử lý và chuyển giao sớm.",
        level: "info",
        to: "/admin/orders",
      });
    }

    if (Number(summary.cancelledOrders || 0) > 0) {
      nextAlerts.push({
        key: "cancelled-orders",
        title: `${summary.cancelledOrders} đơn hàng bị hủy`,
        description: "Kiểm tra lý do khách hủy để giảm tỷ lệ tổn thất doanh số.",
        level: "danger",
        to: "/admin/orders?status=cancelled",
      });
    }

    if (Number(summary.outOfStockProducts || 0) > 0) {
      nextAlerts.push({
        key: "out-of-stock",
        title: `${summary.outOfStockProducts} sản phẩm đã hết hàng`,
        description: "Sản phẩm không thể bán tiếp. Cần nhập hàng hoặc cập nhật trạng thái.",
        level: "danger",
        to: "/admin/notifications",
      });
    }

    if (Number(summary.lowStockProducts || 0) > 0) {
      nextAlerts.push({
        key: "low-stock",
        title: `${summary.lowStockProducts} sản phẩm sắp hết hàng`,
        description: "Cần lên lịch nhập hàng bổ sung để tránh đứt gãy nguồn cung.",
        level: "warning",
        to: "/admin/notifications",
      });
    }

    if (Number(summary.exhaustedDiscounts || 0) > 0) {
      nextAlerts.push({
        key: "discount-exhausted",
        title: `${summary.exhaustedDiscounts} mã giảm giá hết lượt/hạn`,
        description: "Mã giảm giá đã cạn ngân sách hoặc quá hạn sử dụng.",
        level: "danger",
        to: "/admin/discounts",
      });
    }

    if (Number(summary.nearLimitDiscounts || 0) > 0) {
      nextAlerts.push({
        key: "discount-near-limit",
        title: `${summary.nearLimitDiscounts} mã giảm giá sắp chạm hạn`,
        description: "Chuẩn bị mã thay thế để không gián đoạn chuyển đổi mua hàng.",
        level: "warning",
        to: "/admin/discounts",
      });
    }

    if (nextAlerts.length === 0) {
      nextAlerts.push({
        key: "all-good",
        title: "Hệ thống đang ổn định",
        description: "Chưa ghi nhận cảnh báo ưu tiên cao trong chu kỳ theo dõi hiện tại.",
        level: "info",
        to: "/admin/notifications",
      });
    }

    const levelPriority = { danger: 0, warning: 1, info: 2 };
    return nextAlerts
      .sort((a, b) => (levelPriority[a.level] ?? 99) - (levelPriority[b.level] ?? 99))
      .slice(0, 3);
  }, [summary]);

  const activities = useMemo(() => {
    const activityItems = [];

    (sections.newOrders || []).forEach((item) => {
      activityItems.push({
        key: `new-${item._id}`,
        action: `Đơn hàng mới #${String(item._id).slice(-6)}`,
        actor: item.customerName || "Khách hàng",
        time: item.createdAt,
        type: "order",
      });
    });

    (sections.cancelledOrders || []).forEach((item) => {
      activityItems.push({
        key: `cancel-${item._id}`,
        action: `Đơn hàng bị hủy #${String(item._id).slice(-6)}`,
        actor: item.customerName || "Khách hàng",
        time: item.cancelledAt || item.updatedAt,
        type: "cancel",
      });
    });

    (sections.lowStockProducts || []).forEach((item) => {
      activityItems.push({
        key: `low-${item._id}`,
        action: `Sắp hết hàng: ${item.name}`,
        actor: `Tồn kho còn ${Number(item.stock || 0)}`,
        time: item.updatedAt,
        type: "stock",
      });
    });

    (sections.outOfStockProducts || []).forEach((item) => {
      activityItems.push({
        key: `out-${item._id}`,
        action: `Đã hết hàng: ${item.name}`,
        actor: "Cần bổ sung kho",
        time: item.updatedAt,
        type: "out",
      });
    });

    return activityItems
      .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
      .slice(0, 7);
  }, [sections]);

  return (
    <main className="admin-page-container flex flex-col gap-6" aria-busy={loading}>
      {/* ── Dashboard Header ── */}
      <section className="admin-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-admin-ink tracking-tight m-0">
              Bảng điều khiển Quản trị
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Live Real-time
            </span>
          </div>
          <p className="text-sm text-admin-muted m-0">
            Xin chào <strong className="text-admin-ink">{auth?.user?.name || "Admin"}</strong>. Dữ liệu đang được đồng bộ theo thời gian thực.
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-admin-muted">
            <span className="inline-flex items-center gap-1.5">
              <FontAwesomeIcon icon={faClock} className="text-slate-400 text-[11px]" />
              Cập nhật: <strong className="text-slate-700">{formatDateTime(payload?.generatedAt)}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => loadDashboard({ silent: true })}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-admin-line bg-white hover:bg-slate-50 text-admin-body text-xs sm:text-sm font-semibold transition-all shadow-2xs hover:shadow-xs disabled:opacity-60 cursor-pointer"
          >
            <FontAwesomeIcon icon={faRotate} spin={refreshing} className="text-admin-primary" />
            <span>{refreshing ? "Đang đồng bộ..." : "Làm mới"}</span>
          </button>
        </div>
      </section>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium flex items-center gap-2.5 animate-slide-down">
          <FontAwesomeIcon icon={faCircleXmark} className="text-rose-500 text-base" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Bento KPI Metric Grid ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Các chỉ số chính">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="admin-card p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
                {metric.label}
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border text-sm shrink-0 ${metric.colorClass}`}>
                <FontAwesomeIcon icon={metric.icon} />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-admin-ink tracking-tight leading-none mb-2">
                {metric.value.toLocaleString("vi-VN")}
              </div>
              <div className="text-xs text-admin-muted truncate" title={metric.trend}>
                {metric.trend}
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* ── Revenue Intelligence & Product Breakdown ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6" aria-label="Phân tích doanh thu và sản phẩm">
        {/* Left Column (8 cols): Revenue Analytics & Filters */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4">
          <article className="admin-card p-5 sm:p-6 flex flex-col gap-5 h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-admin-line">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-admin-ink m-0 flex items-center gap-2">
                  <FontAwesomeIcon icon={faArrowTrendUp} className="text-admin-primary" />
                  Tổng quan Doanh thu
                </h2>
                <p className="text-xs text-admin-muted m-0 mt-0.5">
                  Thống kê doanh thu theo chu kỳ thanh toán và đơn hoàn tất
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {/* Period segmented buttons */}
                <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPeriodType("month")}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer border-none ${
                      periodType === "month"
                        ? "bg-white text-admin-ink shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-800 bg-transparent"
                    }`}
                  >
                    Tháng
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriodType("year")}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer border-none ${
                      periodType === "year"
                        ? "bg-white text-admin-ink shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-800 bg-transparent"
                    }`}
                  >
                    Năm
                  </button>
                </div>

                {/* Year select */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-xl border border-admin-line bg-white text-xs font-semibold text-admin-ink focus:outline-none focus:border-admin-primary"
                  aria-label="Chọn năm"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      Năm {year}
                    </option>
                  ))}
                </select>

                {/* Month select (if month view) */}
                {periodType === "month" && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-xl border border-admin-line bg-white text-xs font-semibold text-admin-ink focus:outline-none focus:border-admin-primary"
                    aria-label="Chọn tháng"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {getMonthLabel(m)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Financial KPI Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between">
                <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
                  Doanh thu kỳ đã chọn
                </span>
                <div className="text-xl sm:text-2xl font-black text-admin-ink tracking-tight mt-1.5">
                  {formatCurrency(revenue?.totals?.selectedPeriodRevenue)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {periodType === "month" ? `${getMonthLabel(selectedMonth)}/${selectedYear}` : `Cả năm ${selectedYear}`}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between">
                <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
                  Đơn đã hoàn tất kỳ này
                </span>
                <div className="text-xl sm:text-2xl font-black text-admin-ink tracking-tight mt-1.5">
                  {Number(revenue?.totals?.selectedPeriodOrders || 0).toLocaleString("vi-VN")} đơn
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Đã thanh toán và giao thành công
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between">
                <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
                  Doanh thu tháng này
                </span>
                <div className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight mt-1">
                  {formatCurrency(revenue?.totals?.thisMonth)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Tháng {currentDate.getMonth() + 1}/{currentDate.getFullYear()}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between">
                <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
                  Doanh thu năm nay
                </span>
                <div className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight mt-1">
                  {formatCurrency(revenue?.totals?.thisYear)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Năm {currentDate.getFullYear()}
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* Right Column (4-5 cols): Product Breakdown & Doughnut */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col">
          <article className="admin-card p-5 sm:p-6 flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between pb-3 border-b border-admin-line">
              <div>
                <h2 className="text-base font-bold text-admin-ink m-0 flex items-center gap-2">
                  <FontAwesomeIcon icon={faBoxesStacked} className="text-indigo-600" />
                  Sản phẩm bán ra
                </h2>
                <span className="text-xs text-admin-muted mt-0.5">
                  Tỷ trọng doanh số theo mặt hàng
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {totalSoldUnits.toLocaleString("vi-VN")} sp
              </span>
            </div>

            {/* Donut Chart Visual */}
            <div className="flex items-center justify-center py-2">
              <div
                className="w-36 h-36 rounded-full relative shadow-xs flex items-center justify-center transition-all"
                style={{ background: pieBackground }}
              >
                {/* Center Hole */}
                <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                  <span className="text-base font-black text-admin-ink leading-none">
                    {totalSoldUnits.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-admin-muted mt-1">
                    Đã bán
                  </span>
                </div>
              </div>
            </div>

            {/* Product breakdown list with progress bars */}
            <div className="flex-1 overflow-y-auto max-h-[220px] flex flex-col gap-2.5 pr-1 scrollbar-thin">
              {pieSlices.length > 0 ? (
                pieSlices.map((slice) => (
                  <div
                    key={slice.key || slice.label}
                    className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <div className="flex items-center gap-2 truncate max-w-[170px]" title={slice.label}>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: slice.color }} />
                        <span className="truncate text-slate-800">{slice.label}</span>
                      </div>
                      <span className="text-slate-600 font-bold shrink-0">{formatPercent(slice.percent)}</span>
                    </div>

                    {/* Progress line */}
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${slice.percent}%`, background: slice.color }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-admin-muted">
                      <span>{Number(slice.soldQuantity || 0).toLocaleString("vi-VN")} sản phẩm</span>
                      <span className="font-medium text-slate-700">{formatCompactCurrency(slice.revenue)} đ</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-admin-muted">
                  Chưa có dữ liệu sản phẩm trong kỳ đã chọn.
                </div>
              )}
            </div>
          </article>
        </div>
      </section>

      {/* ── Operational Intelligence (Alerts & Activity Hub) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-label="Cảnh báo và hoạt động">
        {/* Column 1: Actionable Alerts */}
        <article className="admin-card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-admin-line">
            <div>
              <h2 className="text-base font-bold text-admin-ink m-0 flex items-center gap-2">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500" />
                Cảnh báo cần xử lý
              </h2>
              <span className="text-xs text-admin-muted">
                Các vấn đề ưu tiên cần admin kiểm tra
              </span>
            </div>
            <Link
              to="/admin/notifications"
              className="text-xs font-bold text-admin-primary hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {alerts.map((alert) => {
              const isDanger = alert.level === "danger";
              const isWarning = alert.level === "warning";

              return (
                <div
                  key={alert.key || alert.title}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isDanger
                      ? "bg-rose-50/70 border-rose-200"
                      : isWarning
                      ? "bg-amber-50/70 border-amber-200"
                      : "bg-blue-50/70 border-blue-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        <FontAwesomeIcon
                          icon={isDanger ? faCircleXmark : isWarning ? faTriangleExclamation : faCircleInfo}
                          className={isDanger ? "text-rose-600" : isWarning ? "text-amber-600" : "text-blue-600"}
                        />
                      </div>
                      <div>
                        <h3 className={`text-sm font-bold m-0 leading-tight ${
                          isDanger ? "text-rose-900" : isWarning ? "text-amber-900" : "text-blue-900"
                        }`}>
                          {alert.title}
                        </h3>
                        <p className="text-xs text-slate-600 m-0 mt-1 leading-relaxed">
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={alert.to}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                        isDanger
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : isWarning
                          ? "bg-amber-600 text-white hover:bg-amber-700"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      <span>Xử lý</span>
                      <FontAwesomeIcon icon={faChevronRight} className="text-[9px]" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        {/* Column 2: Live Activity Feed */}
        <article className="admin-card p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-admin-line">
            <div>
              <h2 className="text-base font-bold text-admin-ink m-0 flex items-center gap-2">
                <FontAwesomeIcon icon={faClock} className="text-blue-600" />
                Hoạt động gần đây
              </h2>
              <span className="text-xs text-admin-muted">
                Dòng thời gian sự kiện mới nhất
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {activities.length} sự kiện
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {activities.length > 0 ? (
              activities.map((act) => (
                <div
                  key={act.key}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      act.type === "order"
                        ? "bg-emerald-500"
                        : act.type === "cancel"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                    }`} />
                    <div className="truncate">
                      <div className="font-bold text-slate-800 truncate" title={act.action}>
                        {act.action}
                      </div>
                      <div className="text-slate-500 text-[11px] truncate">
                        {act.actor}
                      </div>
                    </div>
                  </div>

                  <span className="text-slate-400 font-medium shrink-0 whitespace-nowrap text-[11px]">
                    {formatRelativeTime(act.time)}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-admin-muted">
                Chưa có hoạt động gần đây để hiển thị.
              </div>
            )}
          </div>
        </article>
      </section>

      {/* ── Quick Actions Grid ── */}
      <section className="admin-card p-5 sm:p-6 flex flex-col gap-4" aria-label="Tác vụ nhanh">
        <div className="flex items-center justify-between pb-2 border-b border-admin-line">
          <h2 className="text-base font-bold text-admin-ink m-0">
            Tác vụ quản trị nhanh
          </h2>
          <span className="text-xs text-admin-muted">Phím tắt thao tác</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs no-underline font-bold text-xs sm:text-sm ${action.color}`}
            >
              <FontAwesomeIcon icon={action.icon} className="text-base" />
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

export default AdminDashboard;
