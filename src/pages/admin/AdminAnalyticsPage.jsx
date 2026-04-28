import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import { getAdminFunnelOverview } from "../../services/admin/analyticsService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import "../../css/admin/analytics.css";

const DAY_FILTERS = [7, 30, 90];
const CHART_SERIES = [
  { key: "product_view", label: "Lượt xem", color: "#0f314f" },
  { key: "add_to_cart", label: "Thêm giỏ", color: "#ff6f3c" },
  { key: "wishlist_add", label: "Yêu thích", color: "#7c3aed" },
  { key: "checkout_success", label: "Checkout", color: "#0f766e" },
];
const CHART_POWER_SCALE = 0.72;
const CHECKOUT_VISUAL_LIFT = 6;
const CHART_STROKE_WIDTH = 1.4;
const CHART_POINT_RADIUS = 1.2;
const AUTO_REFRESH_MS = 20000;

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function AdminAnalyticsPage() {
  const { auth } = useAuth();
  const [selectedDays, setSelectedDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useStatusMessageBridge(errorMessage, { title: "Analytics", type: "error" });

  const loadData = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      const data = await getAdminFunnelOverview(auth.token, { days: selectedDays });
      setPayload(data.funnel || null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Không thể tải dữ liệu funnel analytics."));
    } finally {
      setLoading(false);
    }
  }, [auth?.token, selectedDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!auth?.token) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadData();
    }, AUTO_REFRESH_MS);

    return () => clearInterval(intervalId);
  }, [auth?.token, loadData]);

  const summary = useMemo(() => payload?.summary || {}, [payload]);
  const series = useMemo(() => (Array.isArray(payload?.series) ? payload.series : []), [payload]);

  const peakDay = useMemo(() => {
    if (series.length === 0) {
      return null;
    }

    return [...series].sort((a, b) => Number(b.checkout_success || 0) - Number(a.checkout_success || 0))[0];
  }, [series]);

  const chartData = useMemo(
    () =>
      series.map((item) => ({
        date: item.date,
        product_view: Number(item.product_view || 0),
        add_to_cart: Number(item.add_to_cart || 0),
        wishlist_add: Number(item.wishlist_add || 0),
        checkout_success: Number(item.checkout_success || 0),
      })),
    [series]
  );

  const chartMaxValue = useMemo(() => {
    if (chartData.length === 0) {
      return 10;
    }

    const maxValue = chartData.reduce(
      (max, item) =>
        Math.max(max, item.product_view, item.add_to_cart, item.wishlist_add, item.checkout_success),
      0
    );

    return Math.max(10, maxValue);
  }, [chartData]);

  const chartLines = useMemo(() => {
    if (chartData.length === 0) {
      return [];
    }

    const width = 100;
    const height = 100;

    return CHART_SERIES.map((seriesItem) => {
      const points = chartData.map((item, index) => {
        const x = chartData.length === 1 ? 0 : (index / (chartData.length - 1)) * width;
        const rawRatio = Math.max(0, Number(item[seriesItem.key] || 0)) / chartMaxValue;
        const normalizedRatio = Math.pow(rawRatio, CHART_POWER_SCALE);
        const baseY = height - normalizedRatio * height;
        const y =
          seriesItem.key === "checkout_success"
            ? Math.max(0, baseY - CHECKOUT_VISUAL_LIFT)
            : baseY;
        return { x, y, value: Number(item[seriesItem.key] || 0), date: item.date };
      });

      return {
        ...seriesItem,
        points,
        path: points.map((point) => `${point.x},${point.y}`).join(" "),
      };
    });
  }, [chartData, chartMaxValue]);

  return (
    <main className="container page-content admin-analytics-page">
      <section className="hero-card dashboard-surface admin-page-enter" aria-busy={loading}>
        <div className="dashboard-header-row">
          <div>
            <h2>Phễu phân tích</h2>
            <p className="dashboard-subtitle">
              Theo dõi hành trình chuyển đổi từ xem sản phẩm đến thanh toán thành công.
            </p>
          </div>

          <div className="analytics-day-filter-group">
            {DAY_FILTERS.map((day) => (
              <button
                key={day}
                type="button"
                className={`analytics-day-filter-btn ${selectedDays === day ? "active" : ""}`}
                onClick={() => setSelectedDays(day)}
              >
                {day} ngày
              </button>
            ))}
          </div>
        </div>

        <div className="analytics-metric-grid">
          <article className="analytics-metric-card">
            <span>Người dùng hoạt động</span>
            <strong>{Number(summary.uniqueActors || 0).toLocaleString("vi-VN")}</strong>
            <small>Identity hợp lệ trong kỳ</small>
          </article>
          <article className="analytics-metric-card info">
            <span>Lượt xem sản phẩm</span>
            <strong>{Number(summary.productViews || 0).toLocaleString("vi-VN")}</strong>
            <small>Điểm bắt đầu funnel</small>
          </article>
          <article className="analytics-metric-card accent">
            <span>Thêm giỏ hàng</span>
            <strong>{Number(summary.addToCart || 0).toLocaleString("vi-VN")}</strong>
            <small>Tỷ lệ Xem → Giỏ: {formatPercent(summary.viewToCartRate)}</small>
          </article>
          <article className="analytics-metric-card success">
            <span>Thanh toán thành công</span>
            <strong>{Number(summary.checkoutSuccess || 0).toLocaleString("vi-VN")}</strong>
            <small>Tỷ lệ Xem → Thanh toán: {formatPercent(summary.viewToCheckoutRate)}</small>
          </article>
        </div>

        <div className="analytics-kpi-strip">
          <div>
            <span>Giỏ → Thanh toán</span>
            <strong>{formatPercent(summary.cartToCheckoutRate)}</strong>
          </div>
          <div>
            <span>Lượt thêm yêu thích</span>
            <strong>{Number(summary.wishlistAdds || 0).toLocaleString("vi-VN")}</strong>
          </div>
          <div>
            <span>Ngày có checkout cao nhất</span>
            <strong>{peakDay ? peakDay.date : "-"}</strong>
          </div>
        </div>

        <div className="dashboard-table-card analytics-chart-card">
          <div className="analytics-chart-head">
            <h3>Biểu đồ xu hướng funnel theo ngày</h3>
          </div>

          {chartData.length > 0 ? (
            <div className="analytics-chart-wrap">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="analytics-line-chart" role="img" aria-label="Biểu đồ xu hướng funnel">
                <line x1="0" y1="0" x2="100" y2="0" className="analytics-grid-line" />
                <line x1="0" y1="50" x2="100" y2="50" className="analytics-grid-line" />
                <line x1="0" y1="100" x2="100" y2="100" className="analytics-grid-line" />

                {chartLines.map((lineItem) => (
                  <g key={lineItem.key}>
                    <polyline
                      points={lineItem.path}
                      fill="none"
                      stroke={lineItem.color}
                      strokeWidth={CHART_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {lineItem.points.map((point) => (
                      <circle
                        key={`${lineItem.key}-${point.date}`}
                        cx={point.x}
                        cy={point.y}
                        r={CHART_POINT_RADIUS}
                        fill={lineItem.color}
                      >
                        <title>{`${lineItem.label} - ${point.date}: ${point.value.toLocaleString("vi-VN")}`}</title>
                      </circle>
                    ))}
                  </g>
                ))}
              </svg>

              <div className="analytics-chart-axis-labels">
                <span>{chartData[0]?.date}</span>
                <span>{chartData[Math.floor((chartData.length - 1) / 2)]?.date}</span>
                <span>{chartData[chartData.length - 1]?.date}</span>
              </div>

              <div className="analytics-chart-legend analytics-chart-legend--below" aria-label="Chú thích màu biểu đồ">
                {CHART_SERIES.map((item) => (
                  <span key={item.key}>
                    <i style={{ backgroundColor: item.color }} aria-hidden="true" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="analytics-chart-empty">Chưa đủ dữ liệu để hiển thị biểu đồ.</p>
          )}
        </div>

        <div className="dashboard-table-card analytics-table-card">
          <div className="users-table-wrap">
            <table className="users-table dashboard-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Lượt xem</th>
                  <th>Thêm giỏ</th>
                  <th>Yêu thích</th>
                  <th>Thanh toán thành công</th>
                  <th>Xem → Thanh toán</th>
                </tr>
              </thead>
              <tbody>
                {series.map((item) => {
                  const viewCount = Number(item.product_view || 0);
                  const checkoutCount = Number(item.checkout_success || 0);
                  const ratio = viewCount > 0 ? (checkoutCount / viewCount) * 100 : 0;

                  return (
                    <tr key={item.date}>
                      <td>{item.date}</td>
                      <td>{viewCount.toLocaleString("vi-VN")}</td>
                      <td>{Number(item.add_to_cart || 0).toLocaleString("vi-VN")}</td>
                      <td>{Number(item.wishlist_add || 0).toLocaleString("vi-VN")}</td>
                      <td>{checkoutCount.toLocaleString("vi-VN")}</td>
                      <td>{formatPercent(ratio)}</td>
                    </tr>
                  );
                })}
                {series.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="table-empty-cell">
                      Chưa có dữ liệu analytics trong khoảng thời gian này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AdminAnalyticsPage;
