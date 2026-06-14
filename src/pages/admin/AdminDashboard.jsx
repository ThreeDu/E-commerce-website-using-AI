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
} from "@fortawesome/free-solid-svg-icons";
const AUTO_REFRESH_MS = 30000;

const quickActions = [
  { label: "Trung tâm thông báo", to: "/admin/notifications", icon: faBell },
  { label: "Quản lý đơn hàng", to: "/admin/orders", icon: faReceipt },
  { label: "Thêm sản phẩm", to: "/admin/products/add", icon: faPlusCircle },
  { label: "Thêm mã giảm giá", to: "/admin/discounts/add", icon: faTag },
];

const PIE_COLORS = [
  "#0f766e",
  "#0f314f",
  "#ff6f3c",
  "#1d4ed8",
  "#b45309",
  "#0891b2",
  "#7c3aed",
  "#b91c1c",
  "#6b7280",
];

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

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
  if (!value) {
    return "Không rõ thời gian";
  }

  const now = Date.now();
  const target = new Date(value).getTime();

  if (Number.isNaN(target)) {
    return "Không rõ thời gian";
  }

  const diffMinutes = Math.max(0, Math.floor((now - target) / 60000));
  if (diffMinutes < 1) {
    return "Vừa xong";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

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
      if (!auth?.token) {
        return;
      }

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
    if (!auth?.token) {
      return undefined;
    }

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
    const merged = new Set([
      ...availableYears,
      Number(selectedYear),
    ]);

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
      return "conic-gradient(#dbe7f6 0 100%)";
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
        trend: `Trong ${Number(config.recentWindowHours || 24)} giờ gần nhất`,
        tone: "info",
        icon: faCartPlus,
      },
      {
        label: "Đơn bị hủy",
        value: Number(summary.cancelledOrders || 0),
        trend: "Cần kiểm tra nguyên nhân",
        tone: "danger",
        icon: faCircleXmark,
      },
      {
        label: "Sản phẩm sắp hết",
        value: Number(summary.lowStockProducts || 0),
        trend: `Ngưỡng cảnh báo <= ${Number(config.lowStockThreshold || 5)} sản phẩm`,
        tone: "warning",
        icon: faTriangleExclamation,
      },
      {
        label: "Sản phẩm hết hàng",
        value: Number(summary.outOfStockProducts || 0),
        trend: "Ưu tiên bổ sung kho",
        tone: "danger",
        icon: faBoxArchive,
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
        description: "Đơn mới phát sinh gần đây, ưu tiên xác nhận và xử lý sớm.",
        level: "info",
        to: "/admin/orders",
      });
    }

    if (Number(summary.cancelledOrders || 0) > 0) {
      nextAlerts.push({
        key: "cancelled-orders",
        title: `${summary.cancelledOrders} đơn hàng bị hủy`,
        description: "Kiểm tra lý do hủy để giảm tỉ lệ thất thoát đơn hàng.",
        level: "danger",
        to: "/admin/orders?status=cancelled",
      });
    }

    if (Number(summary.outOfStockProducts || 0) > 0) {
      nextAlerts.push({
        key: "out-of-stock",
        title: `${summary.outOfStockProducts} sản phẩm đã hết hàng`,
        description: "Một số sản phẩm không thể bán tiếp. Cần nhập kho hoặc ẩn bán.",
        level: "danger",
        to: "/admin/notifications",
      });
    }

    if (Number(summary.lowStockProducts || 0) > 0) {
      nextAlerts.push({
        key: "low-stock",
        title: `${summary.lowStockProducts} sản phẩm sắp hết hàng`,
        description: "Nên lên kế hoạch bổ sung kho để tránh đứt gãy nguồn cung.",
        level: "warning",
        to: "/admin/notifications",
      });
    }

    if (Number(summary.exhaustedDiscounts || 0) > 0) {
      nextAlerts.push({
        key: "discount-exhausted",
        title: `${summary.exhaustedDiscounts} mã giảm giá đã hết hiệu lực`,
        description: "Mã giảm giá đã hết lượt hoặc hết hạn. Cần thay chiến dịch mới.",
        level: "danger",
        to: "/admin/discounts",
      });
    }

    if (Number(summary.nearLimitDiscounts || 0) > 0) {
      nextAlerts.push({
        key: "discount-near-limit",
        title: `${summary.nearLimitDiscounts} mã giảm giá sắp hết`,
        description: "Chuẩn bị mã thay thế để không gián đoạn chuyển đổi bán hàng.",
        level: "warning",
        to: "/admin/discounts",
      });
    }

    if (nextAlerts.length === 0) {
      nextAlerts.push({
        key: "all-good",
        title: "Hệ thống đang ổn định",
        description: "Chưa phát hiện cảnh báo ưu tiên cao trong chu kỳ theo dõi hiện tại.",
        level: "info",
        to: "/admin/notifications",
      });
    }

    const levelPriority = {
      danger: 0,
      warning: 1,
      info: 2,
    };

    return nextAlerts
      .sort((a, b) => {
        const levelDiff = (levelPriority[a.level] ?? 99) - (levelPriority[b.level] ?? 99);
        if (levelDiff !== 0) {
          return levelDiff;
        }

        const titleA = String(a.title || "");
        const titleB = String(b.title || "");
        return titleA.localeCompare(titleB, "vi");
      })
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
      });
    });

    (sections.cancelledOrders || []).forEach((item) => {
      activityItems.push({
        key: `cancel-${item._id}`,
        action: `Đơn hàng hủy #${String(item._id).slice(-6)}`,
        actor: item.customerName || "Khách hàng",
        time: item.cancelledAt || item.updatedAt,
      });
    });

    (sections.lowStockProducts || []).forEach((item) => {
      activityItems.push({
        key: `low-${item._id}`,
        action: `Sản phẩm sắp hết: ${item.name}`,
        actor: `Tồn kho còn ${Number(item.stock || 0)}`,
        time: item.updatedAt,
      });
    });

    (sections.outOfStockProducts || []).forEach((item) => {
      activityItems.push({
        key: `out-${item._id}`,
        action: `Sản phẩm hết hàng: ${item.name}`,
        actor: "Cần bổ sung kho",
        time: item.updatedAt,
      });
    });

    return activityItems
      .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
      .slice(0, 8);
  }, [sections]);

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section
        className="bg-admin-surface border border-admin-line rounded-3xl shadow-admin p-6 grid gap-4 animate-admin-rise bg-[radial-gradient(circle_at_92%_-10%,rgba(16,55,92,0.15),transparent_38%),radial-gradient(circle_at_0%_100%,rgba(20,109,80,0.09),transparent_30%),#ffffff]"
        aria-label="Tổng quan quản trị"
        aria-busy={loading}
      >
        <header className="flex flex-col md:flex-row justify-between items-start gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-admin-ink mt-0 mb-1">Bảng điều khiển Admin</h2>
            <p className="text-admin-muted mt-2 mb-0 text-sm md:text-base">
              Xin chào <strong>{auth?.user?.name || "Admin"}</strong>. Dữ liệu bên dưới đang đồng bộ theo thời gian thực để theo dõi vận hành nhanh.
            </p>
            <p className="text-xs md:text-sm text-admin-muted mt-2.5">
              Cập nhật lúc: <strong>{formatDateTime(payload?.generatedAt)}</strong>
            </p>
          </div>
          <div className="grid gap-2 justify-items-start md:justify-items-end">
            <span className="inline-flex items-center px-2.5 py-1.5 rounded-full border border-[#c8d9ef] text-[#0f3f84] text-xs font-bold bg-[#f0f6ff]">
              Dữ liệu trực tuyến
            </span>
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[36px] px-3.5 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#3f4f67] text-xs font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => loadDashboard({ silent: true })}
              disabled={refreshing}
            >
              <FontAwesomeIcon icon={faRotate} spin={refreshing} style={{ marginRight: "6px" }} />
              {refreshing ? "Đang làm mới..." : "Làm mới"}
            </button>
          </div>
        </header>

        {errorMessage ? (
          <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl p-3" role="status" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Chỉ số nhanh">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className={`grid gap-1.5 rounded-2xl border border-[#dfebf8] bg-gradient-to-b from-white to-[#f7faff] p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                metric.tone === "success"
                  ? "[&>strong]:text-admin-success"
                  : metric.tone === "info"
                  ? "[&>strong]:text-blue-700"
                  : metric.tone === "warning"
                  ? "[&>strong]:text-amber-700"
                  : "[&>strong]:text-red-700"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <p className="m-0 text-admin-muted text-xs md:text-sm font-medium">{metric.label}</p>
                <FontAwesomeIcon icon={metric.icon} className="text-lg opacity-60" />
              </div>
              <strong className="text-admin-ink text-xl md:text-2xl font-extrabold leading-none">{metric.value}</strong>
              <span className="text-admin-muted text-[11px] md:text-xs">{metric.trend}</span>
            </article>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <article className="rounded-2xl border border-[#e1ebf6] bg-white p-4">
            <div className="flex justify-between items-center gap-2.5 mb-2.5">
              <h3 className="m-0 text-base font-bold text-admin-ink">Cảnh báo cần xử lý</h3>
              <span className="text-admin-muted text-xs">Top {alerts.length} ưu tiên</span>
            </div>
            <div className="grid gap-2.5">
              {alerts.map((alert) => (
                <div
                  key={alert.title}
                  className={`rounded-xl border p-3 ${
                    alert.level === "danger"
                      ? "border-[#f2b8b8] bg-[#fff3f3] [&>div>h4]:text-red-800"
                      : alert.level === "warning"
                      ? "border-[#f6d5a8] bg-[#fff8eb] [&>div>h4]:text-amber-800"
                      : "border-[#c6dbf7] bg-[#f3f8ff] [&>div>h4]:text-blue-800"
                  }`}
                >
                  <div className="flex gap-2 items-center mb-1">
                    <FontAwesomeIcon
                      icon={alert.level === "danger" ? faCircleXmark : alert.level === "warning" ? faTriangleExclamation : faBell}
                    />
                    <h4 className="m-0 text-sm font-semibold">{alert.title}</h4>
                  </div>
                  <p className="mt-1.5 mb-0 text-admin-muted text-[13px] leading-relaxed">{alert.description}</p>
                  <Link to={alert.to} className="mt-2 inline-flex items-center text-xs font-bold text-[#0f3f84] hover:underline">
                    Xem chi tiết <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: "10px", marginLeft: "4px" }} />
                  </Link>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-[#e1ebf6] bg-white p-4">
            <div className="flex justify-between items-center gap-2.5 mb-2.5">
              <h3 className="m-0 text-base font-bold text-admin-ink">Hoạt động gần đây</h3>
              <span className="text-admin-muted text-xs">Top 8 mới nhất</span>
            </div>
            <ul className="m-0 p-0 list-none grid gap-2.5">
              {activities.map((activity) => (
                <li key={activity.key} className="border border-[#e7edf6] rounded-xl p-2.5">
                  <p className="m-0 text-[#1f3348] text-[13px] font-semibold">{activity.action}</p>
                  <div className="mt-1.5 flex justify-between gap-2.5 text-admin-muted text-xs">
                    <span>{activity.actor}</span>
                    <span>
                      <FontAwesomeIcon icon={faClock} style={{ marginRight: "4px", fontSize: "11px", opacity: 0.7 }} />
                      {formatRelativeTime(activity.time)}
                    </span>
                  </div>
                </li>
              ))}
              {activities.length === 0 ? (
                <li className="text-admin-muted text-[13px] py-4 text-center">Chưa có hoạt động nào để hiển thị.</li>
              ) : null}
            </ul>
          </article>
        </section>

        <section className="rounded-2xl border border-[#e1ebf6] bg-white p-4 grid gap-3" aria-label="Doanh thu và phân bổ sản phẩm bán ra">
          <div className="flex justify-between items-center gap-2.5 mb-1.5">
            <h3 className="m-0 text-base font-bold text-admin-ink">Doanh thu</h3>
            <span className="text-admin-muted text-xs font-medium">Tổng bán ra: {Number(totalSoldUnits || 0).toLocaleString("vi-VN")} sản phẩm</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end" role="group" aria-label="Bộ lọc doanh thu">
            <div className="grid gap-1.5 min-w-0 sm:min-w-[150px]">
              <label htmlFor="revenue-period-type" className="text-admin-muted text-xs font-bold">Kiểu xem</label>
              <select
                id="revenue-period-type"
                value={periodType}
                onChange={(event) => setPeriodType(event.target.value)}
                className="w-full border border-admin-line rounded-xl p-[8px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
              >
                <option value="month">Theo tháng</option>
                <option value="year">Theo năm</option>
              </select>
            </div>

            <div className="grid gap-1.5 min-w-0 sm:min-w-[150px]">
              <label htmlFor="revenue-year" className="text-admin-muted text-xs font-bold">Năm</label>
              <select
                id="revenue-year"
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="w-full border border-admin-line rounded-xl p-[8px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {periodType === "month" ? (
              <div className="grid gap-1.5 min-w-0 sm:min-w-[150px]">
                <label htmlFor="revenue-month" className="text-admin-muted text-xs font-bold">Tháng</label>
                <select
                  id="revenue-month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(Number(event.target.value))}
                  className="w-full border border-admin-line rounded-xl p-[8px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((monthNumber) => (
                    <option key={monthNumber} value={monthNumber}>{getMonthLabel(monthNumber)}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <article className="rounded-xl border border-[#dde7f4] bg-gradient-to-b from-white to-[#f7fbff] p-3">
              <p className="m-0 text-admin-muted text-xs font-medium">Doanh thu kỳ đã chọn</p>
              <strong className="mt-1.5 block text-[#0f2233] text-lg md:text-xl font-bold leading-tight">{formatCurrency(revenue?.totals?.selectedPeriodRevenue)}</strong>
            </article>
            <article className="rounded-xl border border-[#dde7f4] bg-gradient-to-b from-white to-[#f7fbff] p-3">
              <p className="m-0 text-admin-muted text-xs font-medium">Đơn đã giao kỳ đã chọn</p>
              <strong className="mt-1.5 block text-[#0f2233] text-lg md:text-xl font-bold leading-tight">{Number(revenue?.totals?.selectedPeriodOrders || 0).toLocaleString("vi-VN")}</strong>
            </article>
            <article className="rounded-xl border border-[#dde7f4] bg-gradient-to-b from-white to-[#f7fbff] p-3">
              <p className="m-0 text-admin-muted text-xs font-medium">Doanh thu tháng này</p>
              <strong className="mt-1.5 block text-[#0f2233] text-lg md:text-xl font-bold leading-tight">{formatCurrency(revenue?.totals?.thisMonth)}</strong>
            </article>
            <article className="rounded-xl border border-[#dde7f4] bg-gradient-to-b from-white to-[#f7fbff] p-3">
              <p className="m-0 text-admin-muted text-xs font-medium">Doanh thu năm nay</p>
              <strong className="mt-1.5 block text-[#0f2233] text-lg md:text-xl font-bold leading-tight">{formatCurrency(revenue?.totals?.thisYear)}</strong>
            </article>
          </div>

          <div className="border border-[#e1ebf6] rounded-2xl bg-[#fbfdff] p-4">
            <div className="text-admin-muted text-xs mb-3 font-semibold">
              {periodType === "month"
                ? `Biểu đồ tròn sản phẩm bán ra trong ${getMonthLabel(selectedMonth)}/${selectedYear}`
                : `Biểu đồ tròn sản phẩm bán ra trong năm ${selectedYear}`}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 items-start">
              <div className="border border-[#dbe6f4] rounded-2xl bg-gradient-to-b from-white to-[#f7fbff] p-4 flex justify-center">
                <div className="w-[180px] h-[180px] rounded-full relative border border-[#d5e2f2] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]" style={{ background: pieBackground }}>
                  <div className="absolute inset-[25%] rounded-full bg-white border border-[#dbe6f4] grid place-items-center text-center shadow-[0_6px_14px_rgba(15,49,79,0.08)]">
                    <strong className="text-[#0f2233] text-base md:text-lg font-bold leading-tight">{Number(totalSoldUnits || 0).toLocaleString("vi-VN")}</strong>
                    <span className="text-admin-muted text-[10px] md:text-xs font-bold uppercase tracking-wider">đã bán</span>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                {pieSlices.length > 0 ? (
                  pieSlices.map((slice) => (
                    <div key={slice.key} className="grid grid-cols-[12px_1fr] gap-2 items-start border border-[#e3ebf7] rounded-xl bg-white p-2.5 shadow-xs">
                      <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: slice.color }} />
                      <div className="min-w-0">
                        <p className="m-0 text-[#0f2233] text-[13px] font-bold truncate" title={slice.label}>{slice.label}</p>
                        <p className="m-0 mt-1 text-admin-muted text-xs leading-relaxed">
                          {Number(slice.soldQuantity || 0).toLocaleString("vi-VN")} sp • {formatPercent(slice.percent)} • {formatCompactCurrency(slice.revenue)} đ
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-admin-muted text-xs py-4 text-center">Chưa có dữ liệu sản phẩm đã bán để dựng biểu đồ.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e1ebf6] bg-white p-4 pb-5" aria-label="Tác vụ nhanh">
          <div className="flex justify-between items-center gap-2.5 mb-3">
            <h3 className="m-0 text-base font-bold text-admin-ink">Tác vụ nhanh</h3>
            <span className="text-admin-muted text-xs">Điều hướng</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.to}
                className="inline-flex items-center justify-center rounded-xl border border-[#d3e1f0] bg-[#f6faff] text-[#0f3f84] font-bold min-h-[42px] text-xs md:text-sm hover:bg-[#eef6ff] transition-all hover:-translate-y-px hover:shadow-xs gap-2"
              >
                <FontAwesomeIcon icon={action.icon} />
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default AdminDashboard;
