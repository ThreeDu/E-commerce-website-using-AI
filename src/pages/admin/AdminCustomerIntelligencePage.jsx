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
  PieChart,
  Pie,
} from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBrain,
  faSync,
  faArrowDown,
  faArrowUp,
  faRobot,
  faUserCheck,
  faSortAmountDown,
  faUserFriends,
  faSearch,
  faFilter,
  faChevronLeft,
  faChevronRight,
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faInfoCircle,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

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
  const [showGuideModal, setShowGuideModal] = useState(false);

  // New retention states
  const [segments, setSegments] = useState(null);
  const [clvData, setClvData] = useState(null);
  const [abandonedCount, setAbandonedCount] = useState(0);

  // Pagination & Search & Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegment, setSelectedSegment] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingEllipsis, setEditingEllipsis] = useState(null); // 'left' or 'right' or null
  const [inputPageValue, setInputPageValue] = useState("");

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
      setModelsReady(false);
    }
  }, [auth?.token]);

  const fetchSegments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/segments`, {
        headers: { Authorization: `Bearer ${auth?.token}` },
      });
      const data = await res.json();
      if (data.models_ready) {
        setSegments(data);
      }
    } catch (err) {
      console.error("Error fetching segments:", err);
    }
  }, [auth?.token]);

  const fetchCLV = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/clv`, {
        headers: { Authorization: `Bearer ${auth?.token}` },
      });
      const data = await res.json();
      if (data.models_ready) {
        setClvData(data);
      }
    } catch (err) {
      console.error("Error fetching CLV:", err);
    }
  }, [auth?.token]);

  const fetchAbandonedCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/abandoned-carts`, {
        headers: { Authorization: `Bearer ${auth?.token}` },
      });
      const data = await res.json();
      setAbandonedCount(data.total || 0);
    } catch (err) {
      console.error("Error fetching abandoned count:", err);
    }
  }, [auth?.token]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/customers?sort=${sortBy}&order=${sortOrder}&limit=1000`,
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
      await fetchSegments();
      await fetchCLV();
      await fetchAbandonedCount();
      await fetchCustomers();
      setLoading(false);
    };
    load();
  }, [fetchOverview, fetchSegments, fetchCLV, fetchAbandonedCount, fetchCustomers]);


  const handleTrain = async () => {
    setTraining(true);
    try {
      const res = await fetch(`${API_BASE}/train`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth?.token}` },
      });
      const data = await res.json();

      if (res.ok) {
        success("Model đã được train lại thành công!", { title: "AI phân tích khách hàng" });
        await fetchOverview();
        await fetchSegments();
        await fetchCLV();
        await fetchAbandonedCount();
        await fetchCustomers();
      } else {
        notifyError(data.message || "Training thất bại.", { title: "AI phân tích khách hàng" });
      }
    } catch (err) {
      notifyError("Không thể kết nối ML service. Đảm bảo Python service đang chạy.", {
        title: "AI phân tích khách hàng",
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

  const segmentNames = {
    champion: { label: "🏆 Champion", desc: "Mua thường xuyên, chi tiêu cao, gần đây", color: "#22c55e" },
    loyal: { label: "💎 Loyal", desc: "Mua đều đặn, gắn bó lâu dài", color: "#3b82f6" },
    potential_loyalist: { label: "🌟 Potential Loyalist", desc: "Khách mới có tiềm năng cao", color: "#a855f7" },
    at_risk: { label: "⚠️ At Risk", desc: "Từng mua nhiều nhưng đang giảm hoạt động", color: "#f97316" },
    hibernating: { label: "😴 Hibernating", desc: "Đã lâu không quay lại", color: "#eab308" },
    lost: { label: "❌ Lost", desc: "Hoàn toàn mất liên lạc", color: "#ef4444" }
  };

  const segmentChartData = segments?.distribution
    ? Object.keys(segmentNames).map(key => ({
        name: segmentNames[key].label,
        value: segments.distribution[key] || 0,
        color: segmentNames[key].color
      })).filter(item => item.value > 0)
    : [];

  // Client-side search and segment filtering
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = selectedSegment ? c.segment === selectedSegment : true;
    return matchesSearch && matchesSegment;
  });

  // Client-side pagination computations
  const totalItems = filteredCustomers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);

  const indexOfLastItem = activePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);

  // Pagination page buttons generator
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push({ type: "page", value: i });
      }
    } else {
      pages.push({ type: "page", value: 1 });

      let start = Math.max(2, activePage - 1);
      let end = Math.min(totalPages - 1, activePage + 1);

      if (activePage <= 2) {
        end = 4;
      } else if (activePage >= totalPages - 1) {
        start = totalPages - 3;
      }

      if (start > 2) {
        pages.push({ type: "ellipsis", id: "left" });
      }

      for (let i = start; i <= end; i++) {
        pages.push({ type: "page", value: i });
      }

      if (end < totalPages - 1) {
        pages.push({ type: "ellipsis", id: "right" });
      }

      pages.push({ type: "page", value: totalPages });
    }
    return pages;
  };


  return (
    <main className="container page-content intel-page">
      <div className="intel-header">
        <h1 className="intel-header__title">
          <FontAwesomeIcon icon={faBrain} style={{ marginRight: "10px", color: "var(--primary-color, #4f46e5)" }} />
          Dự đoán tỷ lệ rời bỏ và đánh giá tiềm năng khách hàng
        </h1>
        <div className="intel-header__actions">
          {overview?.last_training?.trained_at ? (
            <span className="intel-model-info">
              Trained: {new Date(overview.last_training.trained_at).toLocaleString("vi-VN")}
            </span>
          ) : null}
          <button
            className="intel-guide-btn"
            onClick={() => setShowGuideModal(true)}
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#fff",
              color: "#475569",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
          >
            <FontAwesomeIcon icon={faInfoCircle} />
            Chú thích thuật ngữ
          </button>
          <button
            className="intel-train-btn"
            onClick={handleTrain}
            disabled={training}
          >
            {training ? (
              <>
                <FontAwesomeIcon icon={faSync} spin style={{ marginRight: "6px" }} />
                Đang training...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faSync} style={{ marginRight: "6px" }} />
                Train Model
              </>
            )}
          </button>
        </div>
      </div>

      {!modelsReady ? (
        <div className="intel-empty">
          <div className="intel-empty__icon">
            <FontAwesomeIcon icon={faRobot} style={{ color: "var(--primary-color, #4f46e5)" }} />
          </div>
          <h2 className="intel-empty__title">Chưa có model</h2>
          <p className="intel-empty__text">
            Nhấn nút <strong>"Train Model"</strong> để bắt đầu phân tích dữ liệu
            khách hàng bằng Machine Learning. Hệ thống cần ít nhất 5 khách hàng có
            lịch sử hoạt động.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              className="intel-train-btn"
              onClick={handleTrain}
              disabled={training}
            >
              {training ? (
                <>
                  <FontAwesomeIcon icon={faSync} spin style={{ marginRight: "6px" }} />
                  Đang training...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faBrain} style={{ marginRight: "6px" }} />
                  Bắt đầu Training
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="intel-summary-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "16px", marginBottom: "24px" }}>
            <div className="intel-summary-card" style={{ padding: "16px", borderRadius: "10px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <p className="intel-summary-card__label" style={{ fontSize: "13px", color: "#64748b", margin: "0 0 4px 0" }}>Tổng khách hàng</p>
              <p className="intel-summary-card__value" style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#1e293b" }}>{overview?.total_customers || 0}</p>
            </div>
            <div className="intel-summary-card" style={{ padding: "16px", borderRadius: "10px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <p className="intel-summary-card__label" style={{ fontSize: "13px", color: "#64748b", margin: "0 0 4px 0" }}>Nguy cơ rời bỏ cao</p>
              <p className="intel-summary-card__value intel-summary-card__value--red" style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#ef4444" }}>
                {overview?.churn_distribution?.high || 0}
              </p>
            </div>
            <div className="intel-summary-card" style={{ padding: "16px", borderRadius: "10px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <p className="intel-summary-card__label" style={{ fontSize: "13px", color: "#64748b", margin: "0 0 4px 0" }}>Tiềm năng cao</p>
              <p className="intel-summary-card__value intel-summary-card__value--blue" style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#3b82f6" }}>
                {overview?.potential_distribution?.high || 0}
              </p>
            </div>
            <div className="intel-summary-card" style={{ padding: "16px", borderRadius: "10px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <p className="intel-summary-card__label" style={{ fontSize: "13px", color: "#64748b", margin: "0 0 4px 0" }}>CLV Trung bình</p>
              <p className="intel-summary-card__value" style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#8b5cf6" }}>
                {clvData?.avg_clv_score || 0}
              </p>
            </div>
            <div className="intel-summary-card" style={{ padding: "16px", borderRadius: "10px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <p className="intel-summary-card__label" style={{ fontSize: "13px", color: "#64748b", margin: "0 0 4px 0" }}>KH At Risk</p>
              <p className="intel-summary-card__value" style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#f97316" }}>
                {segments?.distribution?.at_risk || 0}
              </p>
            </div>
            <div className="intel-summary-card" style={{ padding: "16px", borderRadius: "10px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <p className="intel-summary-card__label" style={{ fontSize: "13px", color: "#64748b", margin: "0 0 4px 0" }}>Giỏ hàng bỏ rơi</p>
              <p className="intel-summary-card__value" style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#64748b" }}>
                {abandonedCount}
              </p>
            </div>
          </div>

          {/* Segment Distribution Donut Chart */}
          {segments?.distribution && (
            <div className="intel-charts" style={{ display: "grid", gridTemplateColumns: "1fr", marginBottom: "24px" }}>
              <div className="intel-chart-card" style={{ padding: "24px", borderRadius: "12px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <h3 className="intel-chart-card__title" style={{ fontSize: "18px", fontWeight: "600", color: "#1e293b", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <FontAwesomeIcon icon={faUserFriends} style={{ color: "#4f46e5" }} />
                  Phân khúc khách hàng (RFM Segmentation)
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "32px", alignItems: "center" }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={segmentChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {segmentChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Khách hàng`, 'Số lượng']} />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Segment Details Table */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {Object.keys(segmentNames).map(key => {
                      const count = segments.distribution[key] || 0;
                      const percentage = overview?.total_customers ? ((count / overview.total_customers) * 100).toFixed(1) : 0;
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: segmentNames[key].color }} />
                            <strong style={{ color: "#334155" }}>{segmentNames[key].label}</strong>
                          </div>
                          <span style={{ color: "#64748b", fontWeight: "500" }}>
                            {count} KH ({percentage}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

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
            <div className="intel-table-card__header" style={{ marginBottom: "20px" }}>
              <h3 className="intel-table-card__title">
                <FontAwesomeIcon icon={faUserCheck} style={{ marginRight: "8px", color: "var(--primary-color, #4f46e5)" }} />
                Danh sách khách hàng ({filteredCustomers.length})
              </h3>
            </div>

            <div className="intel-table-actions-row">
              <div className="intel-table-filters">
                {/* Search Input */}
                <div className="intel-search-wrapper">
                  <FontAwesomeIcon icon={faSearch} className="intel-search-icon" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="intel-search-input"
                  />
                </div>

                {/* Segment Filter */}
                <div className="intel-filter-wrapper">
                  <FontAwesomeIcon icon={faFilter} style={{ color: "#64748b", fontSize: "13px" }} />
                  <select
                    value={selectedSegment}
                    onChange={(e) => {
                      setSelectedSegment(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="intel-filter-select"
                  >
                    <option value="">Tất cả phân khúc</option>
                    {Object.keys(segmentNames).map((key) => (
                      <option key={key} value={key}>
                        {segmentNames[key].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sort controls */}
              <div className="intel-table-sort">
                <label>
                  <FontAwesomeIcon icon={faSortAmountDown} style={{ marginRight: "4px", color: "var(--text-secondary, #6b7280)" }} />
                  Sắp xếp:
                </label>
                <select value={sortBy} onChange={handleSortChange}>
                  <option value="churn_score">Churn Risk</option>
                  <option value="potential_score">Potential Score</option>
                  <option value="clv_score">CLV Score</option>
                  <option value="monetary">Chi tiêu</option>
                  <option value="recency_days">Lần cuối</option>
                  <option value="frequency">Tần suất</option>
                </select>
                <button
                  type="button"
                  onClick={handleOrderToggle}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    background: "#fff",
                    cursor: "pointer",
                    fontSize: "13px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: "600",
                    color: "#334155",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#fff"}
                >
                  {sortOrder === "desc" ? (
                    <>
                      <FontAwesomeIcon icon={faArrowDown} style={{ color: "var(--danger-color, #ef4444)" }} />
                      Giảm dần
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faArrowUp} style={{ color: "var(--success-color, #22c55e)" }} />
                      Tăng dần
                    </>
                  )}
                </button>
              </div>
            </div>

            <table className="intel-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Phân khúc</th>
                  <th>Churn Risk</th>
                  <th>Potential</th>
                  <th>CLV Score</th>
                  <th>Đơn hàng</th>
                  <th>Chi tiêu</th>
                  <th>Views (30d)</th>
                  <th>Wishlist</th>
                  <th>Không HĐ (ngày)</th>
                </tr>
              </thead>
              <tbody>
                {currentCustomers.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <strong>{c.name}</strong>
                      <br />
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{c.email}</span>
                    </td>
                    <td>
                      {c.segment && segmentNames[c.segment] ? (
                        <span 
                          style={{ 
                            display: "inline-block",
                            padding: "4px 8px",
                            fontSize: "12px",
                            fontWeight: "500",
                            borderRadius: "6px",
                            border: `1px solid ${segmentNames[c.segment].color}`,
                            color: segmentNames[c.segment].color,
                            backgroundColor: `${segmentNames[c.segment].color}10`
                          }}
                        >
                          {segmentNames[c.segment].label}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
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
                    <td>
                      <span className={`intel-badge intel-badge--p-${c.clv_level || "low"}`} style={{ backgroundColor: c.clv_level === "high" ? "#8b5cf6" : undefined, color: c.clv_level === "high" ? "#fff" : undefined }}>
                        {c.clv_score || 0}
                      </span>
                    </td>
                    <td>{c.frequency}</td>
                    <td>{Number(c.monetary || 0).toLocaleString("vi-VN")} đ</td>
                    <td>{c.product_views_30d}</td>
                    <td>{c.wishlist_size}</td>
                    <td>{c.recency_days > 900 ? "—" : c.recency_days}</td>
                  </tr>
                ))}
                {currentCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "#64748b", fontWeight: "500" }}>
                      Không tìm thấy khách hàng phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 0 && (
              <div className="intel-pagination-container">
                <div className="intel-pagination-info">
                  Hiển thị {totalItems === 0 ? 0 : indexOfFirstItem + 1} - {Math.min(indexOfLastItem, totalItems)} trong tổng số {totalItems} khách hàng
                </div>

                <div className="intel-pagination-right">
                  {/* Page Size Selector */}
                  <div className="intel-page-size-selector">
                    <span>Số hàng:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Page Navigation Buttons */}
                  <div className="intel-pagination-pages">
                    {/* First Page */}
                    <button
                      className="intel-pagination-btn"
                      onClick={() => setCurrentPage(1)}
                      disabled={activePage === 1}
                      title="Trang đầu"
                    >
                      <FontAwesomeIcon icon={faAngleDoubleLeft} />
                    </button>

                    {/* Previous Page */}
                    <button
                      className="intel-pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={activePage === 1}
                      title="Trang trước"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>

                    {/* Page Numbers */}
                    {getPageNumbers().map((item, index) => {
                      if (item.type === "ellipsis") {
                        const isEditing = editingEllipsis === item.id;
                        if (isEditing) {
                          return (
                            <input
                              key={`ellipsis-input-${item.id}-${index}`}
                              type="number"
                              min="1"
                              max={totalPages}
                              value={inputPageValue}
                              onChange={(e) => setInputPageValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const pageNum = parseInt(inputPageValue, 10);
                                  if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                    setCurrentPage(pageNum);
                                  }
                                  setEditingEllipsis(null);
                                } else if (e.key === "Escape") {
                                  setEditingEllipsis(null);
                                }
                              }}
                              onBlur={() => {
                                const pageNum = parseInt(inputPageValue, 10);
                                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                  setCurrentPage(pageNum);
                                }
                                setEditingEllipsis(null);
                              }}
                              autoFocus
                              className="intel-pagination-btn"
                              style={{
                                width: "50px",
                                height: "36px",
                                padding: "0",
                                textAlign: "center",
                                border: "1px solid var(--primary-color, #4f46e5)",
                                background: "#fff",
                                color: "#1d1d1f",
                                outline: "none",
                                borderRadius: "8px"
                              }}
                            />
                          );
                        }

                        return (
                          <button
                            key={`dots-${item.id}-${index}`}
                            type="button"
                            className="intel-pagination-btn"
                            onClick={() => {
                              setEditingEllipsis(item.id);
                              setInputPageValue("");
                            }}
                            title="Nhấp để nhập trang trực tiếp"
                            style={{ cursor: "pointer", color: "#94a3b8", fontWeight: "bold" }}
                          >
                            ...
                          </button>
                        );
                      }
                      return (
                        <button
                          key={`page-${item.value}`}
                          className={`intel-pagination-btn ${
                            activePage === item.value ? "intel-pagination-btn--active" : ""
                          }`}
                          onClick={() => setCurrentPage(item.value)}
                        >
                          {item.value}
                        </button>
                      );
                    })}

                    {/* Next Page */}
                    <button
                      className="intel-pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage === totalPages}
                      title="Trang sau"
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>

                    {/* Last Page */}
                    <button
                      className="intel-pagination-btn"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={activePage === totalPages}
                      title="Trang cuối"
                    >
                      <FontAwesomeIcon icon={faAngleDoubleRight} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </>
      )}

      {showGuideModal && (
        <div className="intel-modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="intel-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="intel-modal-header">
              <h2 className="intel-modal-title">
                <FontAwesomeIcon icon={faBrain} style={{ marginRight: "10px", color: "var(--primary-color, #4f46e5)" }} />
                Giải thích chỉ số & Phân loại Phân khúc AI
              </h2>
              <button className="intel-modal-close" onClick={() => setShowGuideModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="intel-modal-body">
              <div className="intel-guide-section">
                <h3 className="intel-guide-subtitle">1. Các chỉ số dự báo bằng Machine Learning</h3>
                <div className="intel-guide-grid">
                  <div className="intel-guide-card">
                    <div className="intel-guide-card__header">
                      <span className="intel-guide-badge badge--churn">Churn Risk (Tỷ lệ rời bỏ)</span>
                    </div>
                    <p className="intel-guide-card__desc">
                      <strong>Định nghĩa:</strong> Xác suất khách hàng ngừng tương tác hoặc rời bỏ hệ thống trong tương lai gần.
                    </p>
                    <p className="intel-guide-card__formula">
                      <strong>Cách tính:</strong> AI (Random Forest) phân tích chuỗi hoạt động thời gian thực (số lần tương tác chatbot, lượt xem sản phẩm, số ngày không mua hàng...) và so sánh với lịch sử rời bỏ của các khách hàng cũ để dự báo xác suất từ 0% đến 100%.
                    </p>
                    <div className="intel-guide-levels">
                      <div className="level-item"><strong style={{ color: "#16a34a" }}>Thấp (≤ 30%):</strong> Gắn kết tốt, hoạt động đều.</div>
                      <div className="level-item"><strong style={{ color: "#ea580c" }}>Trung bình (31-70%):</strong> Cần chú ý, gửi nhắc nhở nhẹ.</div>
                      <div className="level-item"><strong style={{ color: "#dc2626" }}>Cao (> 70%):</strong> Nguy cơ rời đi cực lớn, cần can thiệp khẩn cấp.</div>
                    </div>
                  </div>

                  <div className="intel-guide-card">
                    <div className="intel-guide-card__header">
                      <span className="intel-guide-badge badge--potential">Potential (Điểm tiềm năng)</span>
                    </div>
                    <p className="intel-guide-card__desc">
                      <strong>Định nghĩa:</strong> Triển vọng đóng góp giá trị dài hạn của khách hàng mới để trở thành khách hàng trung thành.
                    </p>
                    <p className="intel-guide-card__formula">
                      <strong>Cách tính:</strong> Sử dụng mô hình <strong>Gradient Boosting Regressor</strong> để chấm điểm dựa trên hành vi ban đầu (tần suất thêm sản phẩm vào wishlist, xem chi tiết sản phẩm, tốc độ phản hồi chatbot và số lượng giao dịch ban đầu).
                    </p>
                    <div className="intel-guide-levels">
                      <div className="level-item"><strong style={{ color: "#16a34a" }}>Cao (≥ 50):</strong> Có triển vọng lớn để phát triển thành khách hàng trung thành.</div>
                      <div className="level-item"><strong style={{ color: "#64748b" }}>Thấp (&lt; 50):</strong> Khách hàng vãng lai hoặc ít tương tác.</div>
                    </div>
                  </div>

                  <div className="intel-guide-card" style={{ gridColumn: "1 / -1" }}>
                    <div className="intel-guide-card__header">
                      <span className="intel-guide-badge badge--clv">CLV Score (Dự đoán giá trị vòng đời)</span>
                    </div>
                    <p className="intel-guide-card__desc">
                      <strong>Định nghĩa:</strong> Tổng giá trị kinh tế (số tiền chi tiêu) mà khách hàng dự kiến sẽ mang lại cho cửa hàng trong toàn bộ vòng đời mua sắm tương lai của họ.
                    </p>
                    <p className="intel-guide-card__formula">
                      <strong>Cách tính:</strong> Sử dụng mô hình <strong>Gradient Boosting Regressor</strong> kết hợp với các chỉ số RFM thực tế để dự báo tổng chi tiêu dài hạn dựa trên: Monetary (tổng số tiền đã chi tiêu), Frequency (tần suất mua hàng), và Recency (mức độ gần đây của đơn hàng cuối).
                    </p>
                    <p className="intel-guide-card__note">
                      💡 <strong>Ứng dụng:</strong> Giúp tối ưu hóa ngân sách tiếp thị. Chỉ tự động gửi Voucher giảm giá cao cho khách hàng có CLV lớn để giữ chân nguồn doanh thu cốt lõi, tránh lãng phí ngân sách đối với nhóm có CLV thấp.
                    </p>
                  </div>
                </div>
              </div>

              <div className="intel-guide-section" style={{ marginTop: "28px" }}>
                <h3 className="intel-guide-subtitle">2. Phân loại Phân khúc khách hàng (Segmentation)</h3>
                <p style={{ fontSize: "13px", color: "#475569", marginBottom: "16px" }}>
                  Hệ thống tự động phân loại khách hàng thành 6 nhóm RFM thông minh:
                </p>
                <div className="intel-segments-table-wrapper">
                  <table className="intel-segments-table">
                    <thead>
                      <tr>
                        <th>Phân khúc</th>
                        <th>Quy tắc phân loại (Hành vi & Điểm số AI)</th>
                        <th>Đặc điểm hành vi</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><span className="intel-segment-pill" style={{ border: "1px solid #22c55e", color: "#22c55e", backgroundColor: "#22c55e10", display: "inline-block", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>🏆 Champion</span></td>
                        <td>Nghỉ mua ≤ 14 ngày, tần suất mua ≥ 5 lần và nằm trong nhóm 20% chi tiêu cao nhất.</td>
                        <td>Khách hàng giá trị nhất. Mua thường xuyên, chi tiêu cực nhiều và mới hoạt động gần đây.</td>
                      </tr>
                      <tr>
                        <td><span className="intel-segment-pill" style={{ border: "1px solid #3b82f6", color: "#3b82f6", backgroundColor: "#3b82f610", display: "inline-block", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>💎 Loyal</span></td>
                        <td>Nghỉ mua ≤ 30 ngày, tần suất mua ≥ 3 lần.</td>
                        <td>Mua sắm đều đặn, gắn bó lâu dài và phản hồi tốt với các chiến dịch.</td>
                      </tr>
                      <tr>
                        <td><span className="intel-segment-pill" style={{ border: "1px solid #a855f7", color: "#a855f7", backgroundColor: "#a855f710", display: "inline-block", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>🌟 Potential Loyalist</span></td>
                        <td>Nghỉ mua ≤ 30 ngày, số đơn từ 1-2 lần, và có điểm tiềm năng AI (CLV) ≥ 50.</td>
                        <td>Khách hàng mới tiềm năng. Mua gần đây, số lượng ít nhưng có điểm tiềm năng cao.</td>
                      </tr>
                      <tr>
                        <td><span className="intel-segment-pill" style={{ border: "1px solid #f97316", color: "#f97316", backgroundColor: "#f9731610", display: "inline-block", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>⚠️ At Risk</span></td>
                        <td>Điểm rời bỏ Churn Risk từ 31% đến 70%, đã mua ít nhất 2 đơn.</td>
                        <td>Khách hàng có nguy cơ. Từng mua nhiều nhưng đang giảm dần tần suất hoạt động.</td>
                      </tr>
                      <tr>
                        <td><span className="intel-segment-pill" style={{ border: "1px solid #eab308", color: "#eab308", backgroundColor: "#eab30810", display: "inline-block", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>😴 Hibernating</span></td>
                        <td>Điểm rời bỏ Churn Risk từ 71% đến 90% hoặc đã ngừng hoạt động trên 45 ngày.</td>
                        <td>Khách hàng ngủ đông. Đã lâu không mua sắm, ít tương tác, khả năng cao sẽ rời đi.</td>
                      </tr>
                      <tr>
                        <td><span className="intel-segment-pill" style={{ border: "1px solid #ef4444", color: "#ef4444", backgroundColor: "#ef444410", display: "inline-block", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>❌ Lost</span></td>
                        <td>Khách hàng không thuộc các nhóm trên (mặc định của hệ thống).</td>
                        <td>Mất liên lạc hoàn toàn hoặc khách hàng mới ít hoạt động, tiềm năng thấp.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminCustomerIntelligencePage;
