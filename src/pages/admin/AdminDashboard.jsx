import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import { getAdminNotifications } from "../../services/admin/notificationService";
import { getAdminRevenueOverview } from "../../services/admin/orderService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import "../../css/admin/dashboard.css";

const AUTO_REFRESH_MS = 30000;

const quickActions = [
  { label: "Trung tâm thông báo", to: "/admin/notifications" },
  { label: "Quản lý đơn hàng", to: "/admin/orders" },
  { label: "Thêm sản phẩm", to: "/admin/products/add" },
  { label: "Thêm mã giảm giá", to: "/admin/discounts/add" },
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
      },
      {
        label: "Đơn bị hủy",
        value: Number(summary.cancelledOrders || 0),
        trend: "Cần kiểm tra nguyên nhân",
        tone: "danger",
      },
      {
        label: "Sản phẩm sắp hết",
        value: Number(summary.lowStockProducts || 0),
        trend: `Ngưỡng cảnh báo <= ${Number(config.lowStockThreshold || 5)} sản phẩm`,
        tone: "warning",
      },
      {
        label: "Sản phẩm hết hàng",
        value: Number(summary.outOfStockProducts || 0),
        trend: "Ưu tiên bổ sung kho",
        tone: "danger",
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
    <main className="container page-content">
      <section className="hero-card admin-dashboard admin-page-enter" aria-label="Tổng quan quản trị" aria-busy={loading}>
        <header className="admin-dashboard-header">
          <div>
            <h2>Bảng điều khiển Admin</h2>
            <p>
              Xin chào <strong>{auth?.user?.name || "Admin"}</strong>. Dữ liệu bên dưới đang đồng bộ theo thời gian thực để theo dõi vận hành nhanh.
            </p>
            <p className="dashboard-meta-note">
              Cập nhật lúc: <strong>{formatDateTime(payload?.generatedAt)}</strong>
            </p>
          </div>
          <div className="dashboard-header-actions">
            <span className="dashboard-badge">Live Data</span>
            <button
              type="button"
              className="dashboard-refresh-btn"
              onClick={() => loadDashboard({ silent: true })}
              disabled={refreshing}
            >
              {refreshing ? "Đang làm mới..." : "Làm mới"}
            </button>
          </div>
        </header>

        {errorMessage ? (
          <p className="form-message" role="status" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}

        <section className="admin-metric-grid" aria-label="Chỉ số nhanh">
          {metrics.map((metric) => (
            <article key={metric.label} className={`admin-metric-card ${metric.tone}`}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.trend}</span>
            </article>
          ))}
        </section>

        <section className="admin-dashboard-layout">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <h3>Cảnh báo cần xử lý</h3>
              <span>Top {alerts.length} ưu tiên</span>
            </div>
            <div className="dashboard-alert-list">
              {alerts.map((alert) => (
                <div key={alert.title} className={`dashboard-alert-item ${alert.level}`}>
                  <h4>{alert.title}</h4>
                  <p>{alert.description}</p>
                  <Link to={alert.to}>Xem chi tiết</Link>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <h3>Hoạt động gần đây</h3>
              <span>Top 8 mới nhất</span>
            </div>
            <ul className="dashboard-activity-list">
              {activities.map((activity) => (
                <li key={activity.key}>
                  <p>{activity.action}</p>
                  <div>
                    <span>{activity.actor}</span>
                    <span>{formatRelativeTime(activity.time)}</span>
                  </div>
                </li>
              ))}
              {activities.length === 0 ? (
                <li className="dashboard-activity-empty">Chưa có hoạt động nào để hiển thị.</li>
              ) : null}
            </ul>
          </article>
        </section>

        <section className="dashboard-panel dashboard-revenue-panel" aria-label="Doanh thu và phân bổ sản phẩm bán ra">
          <div className="panel-heading">
            <h3>Doanh thu</h3>
            <span>Tổng bán ra: {Number(totalSoldUnits || 0).toLocaleString("vi-VN")} sản phẩm</span>
          </div>

          <div className="revenue-filter-bar" role="group" aria-label="Bộ lọc doanh thu">
            <div className="revenue-filter-control">
              <label htmlFor="revenue-period-type">Kiểu xem</label>
              <select
                id="revenue-period-type"
                value={periodType}
                onChange={(event) => setPeriodType(event.target.value)}
              >
                <option value="month">Theo tháng</option>
                <option value="year">Theo năm</option>
              </select>
            </div>

            <div className="revenue-filter-control">
              <label htmlFor="revenue-year">Năm</label>
              <select
                id="revenue-year"
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {periodType === "month" ? (
              <div className="revenue-filter-control">
                <label htmlFor="revenue-month">Tháng</label>
                <select
                  id="revenue-month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(Number(event.target.value))}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((monthNumber) => (
                    <option key={monthNumber} value={monthNumber}>{getMonthLabel(monthNumber)}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="revenue-summary-grid">
            <article className="revenue-summary-card">
              <p>Doanh thu kỳ đã chọn</p>
              <strong>{formatCurrency(revenue?.totals?.selectedPeriodRevenue)}</strong>
            </article>
            <article className="revenue-summary-card">
              <p>Đơn đã giao kỳ đã chọn</p>
              <strong>{Number(revenue?.totals?.selectedPeriodOrders || 0).toLocaleString("vi-VN")}</strong>
            </article>
            <article className="revenue-summary-card">
              <p>Doanh thu tháng này</p>
              <strong>{formatCurrency(revenue?.totals?.thisMonth)}</strong>
            </article>
            <article className="revenue-summary-card">
              <p>Doanh thu năm nay</p>
              <strong>{formatCurrency(revenue?.totals?.thisYear)}</strong>
            </article>
          </div>

          <div className="revenue-chart-shell">
            <div className="revenue-chart-meta">
              {periodType === "month"
                ? `Biểu đồ tròn sản phẩm bán ra trong ${getMonthLabel(selectedMonth)}/${selectedYear}`
                : `Biểu đồ tròn sản phẩm bán ra trong năm ${selectedYear}`}
            </div>
            <div className="revenue-pie-layout">
              <div className="revenue-pie-wrap">
                <div className="revenue-pie" style={{ background: pieBackground }}>
                  <div className="revenue-pie-center">
                    <strong>{Number(totalSoldUnits || 0).toLocaleString("vi-VN")}</strong>
                    <span>đã bán</span>
                  </div>
                </div>
              </div>
              <div className="revenue-legend">
                {pieSlices.length > 0 ? (
                  pieSlices.map((slice) => (
                    <div key={slice.key} className="revenue-legend-item">
                      <span className="revenue-legend-dot" style={{ background: slice.color }} />
                      <div className="revenue-legend-content">
                        <p className="revenue-legend-title" title={slice.label}>{slice.label}</p>
                        <p className="revenue-legend-meta">
                          {Number(slice.soldQuantity || 0).toLocaleString("vi-VN")} sp • {formatPercent(slice.percent)} • {formatCompactCurrency(slice.revenue)} đ
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="revenue-legend-empty">Chưa có dữ liệu sản phẩm đã bán để dựng biểu đồ.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-panel quick-actions-panel" aria-label="Tác vụ nhanh">
          <div className="panel-heading">
            <h3>Tác vụ nhanh</h3>
            <span>Điều hướng</span>
          </div>
          <div className="quick-actions-grid">
            {quickActions.map((action) => (
              <Link key={action.label} to={action.to} className="quick-action-link">
                {action.label}
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default AdminDashboard;
