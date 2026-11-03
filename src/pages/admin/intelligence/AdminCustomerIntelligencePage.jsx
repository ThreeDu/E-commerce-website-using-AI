/**
 * Admin Customer Intelligence Page.
 *
 * Displays ML-powered churn risk and potential customer scores
 * with charts, feature importance, and a sortable customer table.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import {
  getAbandonedCarts,
  getIntelligenceClv,
  getIntelligenceCustomers,
  getIntelligenceOverview,
  getIntelligenceSegments,
  trainIntelligenceModels,
} from "../../../services/admin/adminIntelligenceService";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBrain, faSync, faRobot, faUserCheck, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import IntelligenceGuideModal from "./IntelligenceGuideModal";
import CustomerTablePagination from "./CustomerTablePagination";
import CustomerTable from "./CustomerTable";
import CustomerTableToolbar from "./CustomerTableToolbar";
import SegmentDistributionChart from "./SegmentDistributionChart";

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
      const data = await getIntelligenceOverview(auth?.token);

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
      const data = await getIntelligenceSegments(auth?.token);
      if (data.models_ready) {
        setSegments(data);
      }
    } catch (err) {
      console.error("Error fetching segments:", err);
    }
  }, [auth?.token]);

  const fetchCLV = useCallback(async () => {
    try {
      const data = await getIntelligenceClv(auth?.token);
      if (data.models_ready) {
        setClvData(data);
      }
    } catch (err) {
      console.error("Error fetching CLV:", err);
    }
  }, [auth?.token]);

  const fetchAbandonedCount = useCallback(async () => {
    try {
      const data = await getAbandonedCarts(auth?.token);
      setAbandonedCount(data.total || 0);
    } catch (err) {
      console.error("Error fetching abandoned count:", err);
    }
  }, [auth?.token]);

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await getIntelligenceCustomers(auth?.token, {
        sort: sortBy,
        order: sortOrder,
        limit: 1000,
      });

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
      await trainIntelligenceModels(auth?.token);
      success("Model đã được train lại thành công!", { title: "AI phân tích khách hàng" });
      await fetchOverview();
      await fetchSegments();
      await fetchCLV();
      await fetchAbandonedCount();
      await fetchCustomers();
    } catch (err) {
      if (err.status) {
        notifyError(err.message, { title: "AI phân tích khách hàng" });
        return;
      }
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
      <main className="w-full max-w-[1100px] mx-auto px-4 md:px-0 flex-1 py-10">
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
    <main className="w-full max-w-[1100px] mx-auto px-4 md:px-0 flex-1 py-10">
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
        <div className="w-full text-center p-6 sm:p-12 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] max-w-[576px] mx-auto my-10 shadow-xs animate-admin-rise">
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
          <SegmentDistributionChart overview={overview} segmentChartData={segmentChartData} segmentNames={segmentNames} segments={segments} />

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

            <CustomerTableToolbar handleOrderToggle={handleOrderToggle} handleSortChange={handleSortChange} searchTerm={searchTerm} segmentNames={segmentNames} selectedSegment={selectedSegment} setCurrentPage={setCurrentPage} setSearchTerm={setSearchTerm} setSelectedSegment={setSelectedSegment} sortBy={sortBy} sortOrder={sortOrder} />

            <CustomerTable currentCustomers={currentCustomers} segmentNames={segmentNames} />

            {/* Pagination Controls */}
            <CustomerTablePagination activePage={activePage} editingEllipsis={editingEllipsis} getPageNumbers={getPageNumbers} indexOfFirstItem={indexOfFirstItem} indexOfLastItem={indexOfLastItem} inputPageValue={inputPageValue} itemsPerPage={itemsPerPage} setCurrentPage={setCurrentPage} setEditingEllipsis={setEditingEllipsis} setInputPageValue={setInputPageValue} setItemsPerPage={setItemsPerPage} totalItems={totalItems} totalPages={totalPages} />
          </div>
        </>
      )}

      <IntelligenceGuideModal setShowGuideModal={setShowGuideModal} showGuideModal={showGuideModal} />
    </main>
  );
}

export default AdminCustomerIntelligencePage;

