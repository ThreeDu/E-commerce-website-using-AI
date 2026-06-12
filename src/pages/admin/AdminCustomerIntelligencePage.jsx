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
      <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-admin-muted">
          <p className="font-semibold">Đang tải dữ liệu Intelligence...</p>
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
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 px-1">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="m-0 text-2xl md:text-3xl font-bold tracking-tight text-admin-ink">
          <FontAwesomeIcon icon={faBrain} className="mr-2 text-admin-primary" />
          Dự đoán tỷ lệ rời bỏ và đánh giá tiềm năng khách hàng
        </h1>
        <div className="flex items-center gap-2.5">
          {overview?.last_training?.trained_at ? (
            <span className="text-xs text-admin-muted text-right">
              Trained: {new Date(overview.last_training.trained_at).toLocaleString("vi-VN")}
            </span>
          ) : null}
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#cbd5e1] bg-white text-[#475569] font-semibold text-sm cursor-pointer hover:bg-[#f8fafc] hover:border-[#94a3b8] hover:text-[#1e293b] hover:shadow-xs transition-all duration-150"
            onClick={() => setShowGuideModal(true)}
          >
            <FontAwesomeIcon icon={faInfoCircle} />
            Chú thích thuật ngữ
          </button>
          <button
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-transparent bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-bold text-sm cursor-pointer transition-opacity duration-150 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            onClick={handleTrain}
            disabled={training}
          >
            {training ? (
              <>
                <FontAwesomeIcon icon={faSync} spin className="mr-1.5" />
                Đang training...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faSync} className="mr-1.5" />
                Train Model
              </>
            )}
          </button>
        </div>
      </div>

      {!modelsReady ? (
        <div className="text-center p-12 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] max-w-xl mx-auto my-10 shadow-xs animate-admin-rise">
          <div className="text-5xl mb-4">
            <FontAwesomeIcon icon={faRobot} className="text-admin-primary" />
          </div>
          <h2 className="m-0 mb-2 text-xl font-bold text-[#1e293b]">Chưa có model</h2>
          <p className="m-0 mb-6 text-sm text-[#64748b] leading-relaxed">
            Nhấn nút <strong>"Train Model"</strong> để bắt đầu phân tích dữ liệu
            khách hàng bằng Machine Learning. Hệ thống cần ít nhất 5 khách hàng có
            lịch sử hoạt động.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              className="inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-lg border border-transparent bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-bold text-sm cursor-pointer transition-opacity duration-150 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
              onClick={handleTrain}
              disabled={training}
            >
              {training ? (
                <>
                  <FontAwesomeIcon icon={faSync} spin className="mr-1.5" />
                  Đang training...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faBrain} className="mr-1.5" />
                  Bắt đầu Training
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-7">
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <p className="m-0 mb-1 text-[11px] text-[#64748b] font-bold uppercase tracking-wider">Tổng khách hàng</p>
              <strong className="m-0 text-3xl font-extrabold leading-none text-admin-ink">{overview?.total_customers || 0}</strong>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <p className="m-0 mb-1 text-[11px] text-[#64748b] font-bold uppercase tracking-wider">Nguy cơ rời bỏ cao</p>
              <strong className="m-0 text-3xl font-extrabold leading-none text-red-600">
                {overview?.churn_distribution?.high || 0}
              </strong>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <p className="m-0 mb-1 text-[11px] text-[#64748b] font-bold uppercase tracking-wider">Tiềm năng cao</p>
              <strong className="m-0 text-3xl font-extrabold leading-none text-blue-600">
                {overview?.potential_distribution?.high || 0}
              </strong>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <p className="m-0 mb-1 text-[11px] text-[#64748b] font-bold uppercase tracking-wider">CLV Trung bình</p>
              <strong className="m-0 text-3xl font-extrabold leading-none text-purple-600">
                {clvData?.avg_clv_score || 0}
              </strong>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <p className="m-0 mb-1 text-[11px] text-[#64748b] font-bold uppercase tracking-wider">KH At Risk</p>
              <strong className="m-0 text-3xl font-extrabold leading-none text-orange-500">
                {segments?.distribution?.at_risk || 0}
              </strong>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <p className="m-0 mb-1 text-[11px] text-[#64748b] font-bold uppercase tracking-wider">Giỏ hàng bỏ rơi</p>
              <strong className="m-0 text-3xl font-extrabold leading-none text-slate-500">{abandonedCount}</strong>
            </div>
          </div>

          {/* Segment Distribution Donut Chart */}
          {segments?.distribution && (
            <div className="grid grid-cols-1 mb-6">
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs">
                <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b] flex items-center gap-2">
                  <FontAwesomeIcon icon={faUserFriends} className="text-admin-primary" />
                  Phân khúc khách hàng (RFM Segmentation)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-8 items-center">
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

                  <div className="flex flex-col gap-3">
                    {Object.keys(segmentNames).map(key => {
                      const count = segments.distribution[key] || 0;
                      const percentage = overview?.total_customers ? ((count / overview.total_customers) * 100).toFixed(1) : 0;
                      return (
                        <div key={key} className="flex items-center justify-between text-sm border-b border-[#f1f5f9] pb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 height-2.5 rounded-full" style={{ backgroundColor: segmentNames[key].color, height: "10px", width: "10px" }} />
                            <strong className="text-[#334155]">{segmentNames[key].label}</strong>
                          </div>
                          <span className="text-admin-muted font-semibold">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
              <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b]">Phân bố Churn Risk</h3>
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

            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
              <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b]">Phân bố Potential Score</h3>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
              <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b]">Churn — Feature Importance</h3>
              <ul className="list-none p-0 m-0">
                {(overview?.churn_feature_importance || []).map(([name, score]) => (
                  <li key={name} className="flex items-center gap-2.5 py-1.5 text-[13px] text-[#334155]">
                    <span className="min-w-[160px] font-semibold">{name}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a78bfa] transition-all duration-300"
                        style={{ width: `${Math.round(score * 100)}%` }}
                      />
                    </div>
                    <span className="min-w-[40px] text-right text-admin-muted text-xs">{(score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
              <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b]">Potential — Feature Importance</h3>
              <ul className="list-none p-0 m-0">
                {(overview?.potential_feature_importance || []).map(([name, score]) => (
                  <li key={name} className="flex items-center gap-2.5 py-1.5 text-[13px] text-[#334155]">
                    <span className="min-w-[160px] font-semibold">{name}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.round(score * 100)}%`,
                          background: "linear-gradient(90deg, #3b82f6, #93c5fd)",
                        }}
                      />
                    </div>
                    <span className="min-w-[40px] text-right text-admin-muted text-xs">{(score * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Customer Table */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 overflow-x-auto shadow-xs mb-7">
            <div className="flex justify-between items-center margin-bottom-16 flex-wrap gap-3 mb-5">
              <h3 className="m-0 text-base font-bold text-[#1e293b] flex items-center gap-2">
                <FontAwesomeIcon icon={faUserCheck} className="text-admin-primary" />
                Danh sách khách hàng ({filteredCustomers.length})
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-5 w-full">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative flex items-center">
                  <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 text-admin-muted text-sm" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 pr-3 py-2 border border-admin-line rounded-xl text-sm bg-[#f8fafc] text-admin-ink w-full sm:w-[260px] transition-all duration-300 focus:outline-none focus:bg-white focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] focus:w-full sm:focus:w-[300px]"
                  />
                </div>

                {/* Segment Filter */}
                <div className="flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faFilter} className="text-admin-muted text-xs" />
                  <select
                    value={selectedSegment}
                    onChange={(e) => {
                      setSelectedSegment(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full border border-admin-line rounded-xl p-[8px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled cursor-pointer"
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
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-[13px] text-admin-muted">
                  <FontAwesomeIcon icon={faSortAmountDown} className="mr-1 text-admin-muted" />
                  Sắp xếp:
                </label>
                <select
                  value={sortBy}
                  onChange={handleSortChange}
                  className="border border-[#cbd5e1] rounded-lg p-[6px_10px] text-[13px] bg-white focus:outline-none focus:border-admin-primary"
                >
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
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white text-xs font-bold text-admin-ink hover:bg-[#f8fafc] transition-all cursor-pointer"
                >
                  {sortOrder === "desc" ? (
                    <>
                      <FontAwesomeIcon icon={faArrowDown} className="text-red-500" />
                      Giảm dần
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faArrowUp} className="text-admin-success" />
                      Tăng dần
                    </>
                  )}
                </button>
              </div>
            </div>

            <table className="w-full text-left border-collapse table-auto text-sm">
              <thead>
                <tr className="[&>th]:p-3 [&>th]:border-b-2 [&>th]:border-[#e2e8f0] [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-[#475569] [&>th]:whitespace-nowrap">
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
              <tbody className="divide-y divide-slate-100">
                {currentCustomers.map((c) => (
                  <tr key={c._id} className="hover:bg-[#f8fafc] [&>td]:p-3 [&>td]:text-[#334155] [&>td]:align-middle">
                    <td>
                      <strong className="text-admin-ink">{c.name}</strong>
                      <br />
                      <span className="text-xs text-admin-muted">{c.email}</span>
                    </td>
                    <td>
                      {c.segment && segmentNames[c.segment] ? (
                        <span
                          className="inline-block px-2 py-1 text-xs font-medium rounded-md border"
                          style={{
                            borderColor: segmentNames[c.segment].color,
                            color: segmentNames[c.segment].color,
                            backgroundColor: `${segmentNames[c.segment].color}10`
                          }}
                        >
                          {segmentNames[c.segment].label}
                        </span>
                      ) : (
                        <span className="text-admin-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        c.churn_level === "low" ? "bg-green-100 text-green-800" : c.churn_level === "medium" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                      }`}>
                        {c.churn_score}%
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        c.potential_level === "low" ? "bg-slate-100 text-slate-600" : c.potential_level === "medium" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                      }`}>
                        {c.potential_score}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                        c.clv_level === "high" ? "bg-purple-100 text-purple-800" : c.clv_level === "medium" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                      }`}>
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
                    <td colSpan={10} className="text-center! p-8! text-admin-muted font-medium">
                      Không tìm thấy khách hàng phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 mt-4 border-t border-[#f1f5f9]">
                <div className="text-[13.5px] text-admin-muted font-medium">
                  Hiển thị {totalItems === 0 ? 0 : indexOfFirstItem + 1} - {Math.min(indexOfLastItem, totalItems)} trong tổng số {totalItems} khách hàng
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Page Size Selector */}
                  <div className="flex items-center gap-2 text-[13.5px] text-admin-muted font-medium">
                    <span>Số hàng:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="p-1 border border-[#e2e8f0] rounded-lg bg-white focus:outline-none cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Page Navigation Buttons */}
                  <div className="flex items-center gap-1.5">
                    {/* First Page */}
                    <button
                      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      onClick={() => setCurrentPage(1)}
                      disabled={activePage === 1}
                      title="Trang đầu"
                    >
                      <FontAwesomeIcon icon={faAngleDoubleLeft} />
                    </button>

                    {/* Previous Page */}
                    <button
                      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
                              className="inline-flex items-center justify-center w-[50px] h-9 px-1 rounded-xl border border-admin-primary bg-white text-admin-ink text-center text-[13px] font-bold outline-none"
                            />
                          );
                        }

                        return (
                          <button
                            key={`dots-${item.id}-${index}`}
                            type="button"
                            className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#94a3b8] text-[13px] font-bold cursor-pointer hover:bg-[#eef4fb]"
                            onClick={() => {
                              setEditingEllipsis(item.id);
                              setInputPageValue("");
                            }}
                            title="Nhấp để nhập trang trực tiếp"
                          >
                            ...
                          </button>
                        );
                      }
                      return (
                        <button
                          key={`page-${item.value}`}
                          className={`inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border text-[13px] font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px ${
                            activePage === item.value
                              ? "bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] border-transparent text-white shadow-md hover:translate-y-0"
                              : "border-[#cbd5e8] bg-white text-[#5f6f85] hover:bg-[#eef4fb]"
                          }`}
                          onClick={() => setCurrentPage(item.value)}
                        >
                          {item.value}
                        </button>
                      );
                    })}

                    {/* Next Page */}
                    <button
                      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage === totalPages}
                      title="Trang sau"
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>

                    {/* Last Page */}
                    <button
                      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
        <div className="fixed inset-0 bg-[rgba(15,23,42,0.65)] backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowGuideModal(false)}>
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-[850px] max-h-[85vh] overflow-y-auto border border-[#e2e8f0] animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-[#f1f5f9] flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="m-0 text-lg md:text-xl font-bold text-[#0f172a] flex items-center gap-2">
                <FontAwesomeIcon icon={faBrain} className="text-admin-primary" />
                Giải thích chỉ số & Phân loại Phân khúc AI
              </h2>
              <button className="bg-none border-none text-admin-muted text-xl cursor-pointer p-1.5 rounded-lg flex items-center justify-center hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-all" onClick={() => setShowGuideModal(false)}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b] border-l-4 border-[#6366f1] pl-2.5">1. Các chỉ số dự báo bằng Machine Learning</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4.5 flex flex-col gap-3">
                    <div className="flex items-center">
                      <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800">Churn Risk (Tỷ lệ rời bỏ)</span>
                    </div>
                    <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                      <strong>Định nghĩa:</strong> Xác suất khách hàng ngừng tương tác hoặc rời bỏ hệ thống trong tương lai gần.
                    </p>
                    <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                      <strong>Cách tính:</strong> AI (Random Forest) phân tích chuỗi hoạt động thời gian thực (số lần tương tác chatbot, lượt xem sản phẩm, số ngày không mua hàng...) và so sánh với lịch sử rời bỏ của các khách hàng cũ để dự báo xác suất từ 0% đến 100%.
                    </p>
                    <div className="flex flex-col gap-1.5 mt-1 bg-white p-2.5 border border-[#f1f5f9] rounded-lg">
                      <div className="text-[12.5px] text-[#475569]"><strong className="text-green-600">Thấp (≤ 30%):</strong> Gắn kết tốt, hoạt động đều.</div>
                      <div className="text-[12.5px] text-[#475569]"><strong className="text-orange-500">Trung bình (31-70%):</strong> Cần chú ý, gửi nhắc nhở nhẹ.</div>
                      <div className="text-[12.5px] text-[#475569]"><strong className="text-red-600">Cao (> 70%):</strong> Nguy cơ rời đi cực lớn, cần can thiệp khẩn cấp.</div>
                    </div>
                  </div>

                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4.5 flex flex-col gap-3">
                    <div className="flex items-center">
                      <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800">Potential (Điểm tiềm năng)</span>
                    </div>
                    <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                      <strong>Định nghĩa:</strong> Triển vọng đóng góp giá trị dài hạn của khách hàng mới để trở thành khách hàng trung thành.
                    </p>
                    <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                      <strong>Cách tính:</strong> Sử dụng mô hình <strong>Gradient Boosting Regressor</strong> để chấm điểm dựa trên hành vi ban đầu (tần suất thêm sản phẩm vào wishlist, xem chi tiết sản phẩm, tốc độ phản hồi chatbot và số lượng giao dịch ban đầu).
                    </p>
                    <div className="flex flex-col gap-1.5 mt-1 bg-white p-2.5 border border-[#f1f5f9] rounded-lg">
                      <div className="text-[12.5px] text-[#475569]"><strong className="text-green-600">Cao (≥ 50):</strong> Có triển vọng lớn để phát triển thành khách hàng trung thành.</div>
                      <div className="text-[12.5px] text-[#475569]"><strong className="text-slate-500">Thấp (&lt; 50):</strong> Khách hàng vãng lai hoặc ít tương tác.</div>
                    </div>
                  </div>

                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4.5 flex flex-col gap-3 md:col-span-2">
                    <div className="flex items-center">
                      <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">CLV Score (Dự đoán giá trị vòng đời)</span>
                    </div>
                    <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                      <strong>Định nghĩa:</strong> Tổng giá trị kinh tế (số tiền chi tiêu) mà khách hàng dự kiến sẽ mang lại cho cửa hàng trong toàn bộ vòng đời mua sắm tương lai của họ.
                    </p>
                    <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                      <strong>Cách tính:</strong> Sử dụng mô hình <strong>Gradient Boosting Regressor</strong> kết hợp với các chỉ số RFM thực tế để dự báo tổng chi tiêu dài hạn dựa trên: Monetary (tổng số tiền đã chi tiêu), Frequency (tần suất mua hàng), và Recency (mức độ gần đây của đơn hàng cuối).
                    </p>
                    <p className="m-0 text-[12.5px] text-[#475569] leading-relaxed bg-[#eff6ff] p-3 border-l-3 border-blue-500 rounded-lg">
                      💡 <strong>Ứng dụng:</strong> Giúp tối ưu hóa ngân sách tiếp thị. Chỉ tự động gửi Voucher giảm giá cao cho khách hàng có CLV lớn để giữ chân nguồn doanh thu cốt lõi, tránh lãng phí ngân sách đối với nhóm có CLV thấp.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b] border-l-4 border-[#6366f1] pl-2.5">2. Phân loại Phân khúc khách hàng (Segmentation)</h3>
                <p className="text-xs text-admin-muted mb-3.5">
                  Hệ thống tự động phân loại khách hàng thành 6 nhóm RFM thông minh:
                </p>
                <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl bg-white">
                  <table className="w-full border-collapse text-sm text-left">
                    <thead>
                      <tr className="[&>th]:bg-[#f8fafc] [&>th]:p-3 [&>th]:font-bold [&>th]:color-[#475569] [&>th]:border-b-2 [&>th]:border-[#e2e8f0] [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider">
                        <th>Phân khúc</th>
                        <th>Quy tắc phân loại (Hành vi & Điểm số AI)</th>
                        <th>Đặc điểm hành vi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                        <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-green-500 text-green-500 bg-green-50">🏆 Champion</span></td>
                        <td>Nghỉ mua ≤ 14 ngày, tần suất mua ≥ 5 lần và nằm trong nhóm 20% chi tiêu cao nhất.</td>
                        <td>Khách hàng giá trị nhất. Mua thường xuyên, chi tiêu cực nhiều và mới hoạt động gần đây.</td>
                      </tr>
                      <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                        <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-blue-500 text-blue-500 bg-blue-50">💎 Loyal</span></td>
                        <td>Nghỉ mua ≤ 30 ngày, tần suất mua ≥ 3 lần.</td>
                        <td>Mua sắm đều đặn, gắn bó lâu dài và phản hồi tốt với các chiến dịch.</td>
                      </tr>
                      <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                        <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-purple-500 text-purple-500 bg-purple-50">🌟 Potential Loyalist</span></td>
                        <td>Nghỉ mua ≤ 30 ngày, số đơn từ 1-2 lần, và có điểm tiềm năng AI (CLV) ≥ 50.</td>
                        <td>Khách hàng mới tiềm năng. Mua gần đây, số lượng ít nhưng có điểm tiềm năng cao.</td>
                      </tr>
                      <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                        <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-orange-500 text-orange-500 bg-orange-50">⚠️ At Risk</span></td>
                        <td>Điểm rời bỏ Churn Risk từ 31% đến 70%, đã mua ít nhất 2 đơn.</td>
                        <td>Khách hàng có nguy cơ. Từng mua nhiều nhưng đang giảm dần tần suất hoạt động.</td>
                      </tr>
                      <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                        <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-yellow-500 text-yellow-500 bg-yellow-50">😴 Hibernating</span></td>
                        <td>Điểm rời bỏ Churn Risk từ 71% đến 90% hoặc đã ngừng hoạt động trên 45 ngày.</td>
                        <td>Khách hàng ngủ đông. Đã lâu không mua sắm, ít tương tác, khả năng cao sẽ rời đi.</td>
                      </tr>
                      <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                        <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-red-500 text-red-500 bg-red-50">❌ Lost</span></td>
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

