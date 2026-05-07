/**
 * Admin Customer Intelligence Page.
 *
 * Displays ML-powered churn risk and potential customer scores
 * with charts, feature importance, and a sortable customer table.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import "../../css/admin/intelligence.css";

const API_BASE = "/api/auth/admin/intelligence";

function AdminCustomerIntelligencePage() {
  const { auth } = useAuth();
  const { success, error: notifyError } = useNotification();

  const [overview, setOverview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [training, setTraining] = useState(false);
  const [sortBy, setSortBy] = useState("churn_score");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/overview`, {
        headers: { Authorization: `Bearer ${auth?.token}` },
      });
      const data = await res.json();

      if (data.models_ready) {
        setModelsReady(true);
        setOverview(data.overview);
      } else {
        setModelsReady(false);
      }
    } catch (err) {
      // ML service not available
      setModelsReady(false);
    }
  }, [auth?.token]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/customers?sort=${sortBy}&order=${sortOrder}&limit=50`,
        { headers: { Authorization: `Bearer ${auth?.token}` } }
      );
      const data = await res.json();

      if (data.customers) {
        setCustomers(data.customers);
      }
    } catch (err) {
      // Silent
    }
  }, [auth?.token, sortBy, sortOrder]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchOverview();
      await fetchCustomers();
      setLoading(false);
    };
    load();
  }, [fetchOverview, fetchCustomers]);

  const handleTrain = async () => {
    setTraining(true);
    try {
      const res = await fetch(`${API_BASE}/train`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth?.token}` },
      });
      const data = await res.json();

      if (res.ok) {
        success("Model đã được train lại thành công!", { title: "Customer Intelligence" });
        await fetchOverview();
        await fetchCustomers();
      } else {
        notifyError(data.message || "Training thất bại.", { title: "Customer Intelligence" });
      }
    } catch (err) {
      notifyError("Không thể kết nối ML service. Đảm bảo Python service đang chạy.", {
        title: "Customer Intelligence",
      });
    } finally {
      setTraining(false);
    }
  };

  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };

  const handleOrderToggle = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  if (loading) {
    return (
      <main className="container page-content">
        <div className="intel-loading">
          <p>Đang tải dữ liệu Intelligence...</p>
        </div>
      </main>
    );
  }

  // Distribution chart data
  const churnChartData = overview
    ? [
        { name: "Thấp (0-30)", value: overview.churn_distribution.low, color: "#22c55e" },
        { name: "Trung bình (31-60)", value: overview.churn_distribution.medium, color: "#eab308" },
        { name: "Cao (61-100)", value: overview.churn_distribution.high, color: "#ef4444" },
      ]
    : [];

  const potentialChartData = overview
    ? [
        { name: "Thấp (0-30)", value: overview.potential_distribution.low, color: "#94a3b8" },
        { name: "Trung bình (31-60)", value: overview.potential_distribution.medium, color: "#3b82f6" },
        { name: "Cao (61-100)", value: overview.potential_distribution.high, color: "#8b5cf6" },
      ]
    : [];

  return (
    <main className="container page-content intel-page">
      <div className="intel-header">
        <h1 className="intel-header__title">🧠 Customer Intelligence</h1>
        <div className="intel-header__actions">
          {overview?.last_training?.trained_at ? (
            <span className="intel-model-info">
              Trained: {new Date(overview.last_training.trained_at).toLocaleString("vi-VN")}
            </span>
          ) : null}
          <button
            className="intel-train-btn"
            onClick={handleTrain}
            disabled={training}
          >
            {training ? "Đang training..." : "🔄 Train Model"}
          </button>
        </div>
      </div>

      {!modelsReady ? (
        <div className="intel-empty">
          <div className="intel-empty__icon">🤖</div>
          <h2 className="intel-empty__title">Chưa có model</h2>
          <p className="intel-empty__text">
            Nhấn nút <strong>"Train Model"</strong> để bắt đầu phân tích dữ liệu
            khách hàng bằng Machine Learning. Hệ thống cần ít nhất 5 khách hàng có
            lịch sử hoạt động.
          </p>
          <button
            className="intel-train-btn"
            onClick={handleTrain}
            disabled={training}
          >
            {training ? "Đang training..." : "🚀 Bắt đầu Training"}
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="intel-summary-grid">
            <div className="intel-summary-card">
              <p className="intel-summary-card__label">Tổng khách hàng</p>
              <p className="intel-summary-card__value">{overview?.total_customers || 0}</p>
            </div>
            <div className="intel-summary-card">
              <p className="intel-summary-card__label">Nguy cơ rời bỏ cao</p>
              <p className="intel-summary-card__value intel-summary-card__value--red">
                {overview?.churn_distribution?.high || 0}
              </p>
            </div>
            <div className="intel-summary-card">
              <p className="intel-summary-card__label">Tiềm năng cao</p>
              <p className="intel-summary-card__value intel-summary-card__value--blue">
                {overview?.potential_distribution?.high || 0}
              </p>
            </div>
            <div className="intel-summary-card">
              <p className="intel-summary-card__label">Churn trung bình</p>
              <p className="intel-summary-card__value">
                {overview?.avg_churn_score || 0}%
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="intel-charts">
            <div className="intel-chart-card">
              <h3 className="intel-chart-card__title">Phân bố Churn Risk</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={churnChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {churnChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="intel-chart-card">
              <h3 className="intel-chart-card__title">Phân bố Potential Score</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={potentialChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {potentialChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Feature Importance */}
          <div className="intel-charts">
            <div className="intel-chart-card">
              <h3 className="intel-chart-card__title">Churn — Feature Importance</h3>
              <ul className="intel-feature-list">
                {(overview?.churn_feature_importance || []).map(([name, score]) => (
                  <li key={name} className="intel-feature-item">
                    <span className="intel-feature-name">{name}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        className="intel-feature-bar"
                        style={{ width: `${Math.round(score * 100)}%` }}
                      />
                    </div>
                    <span className="intel-feature-score">{(score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="intel-chart-card">
              <h3 className="intel-chart-card__title">Potential — Feature Importance</h3>
              <ul className="intel-feature-list">
                {(overview?.potential_feature_importance || []).map(([name, score]) => (
                  <li key={name} className="intel-feature-item">
                    <span className="intel-feature-name">{name}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        className="intel-feature-bar"
                        style={{
                          width: `${Math.round(score * 100)}%`,
                          background: "linear-gradient(90deg, #3b82f6, #93c5fd)",
                        }}
                      />
                    </div>
                    <span className="intel-feature-score">{(score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Customer Table */}
          <div className="intel-table-card">
            <div className="intel-table-card__header">
              <h3 className="intel-table-card__title">Danh sách khách hàng</h3>
              <div className="intel-table-sort">
                <label>Sắp xếp:</label>
                <select value={sortBy} onChange={handleSortChange}>
                  <option value="churn_score">Churn Risk</option>
                  <option value="potential_score">Potential Score</option>
                  <option value="monetary">Chi tiêu</option>
                  <option value="recency_days">Lần cuối</option>
                  <option value="frequency">Tần suất</option>
                </select>
                <button
                  type="button"
                  onClick={handleOrderToggle}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  {sortOrder === "desc" ? "↓ Giảm dần" : "↑ Tăng dần"}
                </button>
              </div>
            </div>

            <table className="intel-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Churn Risk</th>
                  <th>Potential</th>
                  <th>Đơn hàng</th>
                  <th>Chi tiêu</th>
                  <th>Views (30d)</th>
                  <th>Wishlist</th>
                  <th>Không HĐ (ngày)</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <strong>{c.name}</strong>
                      <br />
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{c.email}</span>
                    </td>
                    <td>
                      <span className={`intel-badge intel-badge--${c.churn_level}`}>
                        {c.churn_score}%
                      </span>
                    </td>
                    <td>
                      <span className={`intel-badge intel-badge--p-${c.potential_level}`}>
                        {c.potential_score}
                      </span>
                    </td>
                    <td>{c.frequency}</td>
                    <td>{Number(c.monetary || 0).toLocaleString("vi-VN")} đ</td>
                    <td>{c.product_views_30d}</td>
                    <td>{c.wishlist_size}</td>
                    <td>{c.recency_days > 900 ? "—" : c.recency_days}</td>
                  </tr>
                ))}
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>
                      Không có dữ liệu khách hàng.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

export default AdminCustomerIntelligencePage;
