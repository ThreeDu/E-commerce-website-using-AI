import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import { getAdminSystemLogs } from "../../services/admin/systemLogService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronUp,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import "../../css/admin/discounts.css";
import "../../css/admin/systemLogs.css";

const ACTION_OPTIONS = [
  "all",
  "create",
  "update",
  "delete",
  "train_model",
  "run_churn_intervention",
  "send_cart_reminders",
  "update_points",
];
const RESOURCE_OPTIONS = [
  "all",
  "product",
  "discount",
  "category",
  "user",
  "rewardTier",
  "ai_model",
  "campaign",
];

const ACTION_LABELS = {
  all: "Tất cả hành động",
  create: "Thêm mới (Create)",
  update: "Cập nhật (Update)",
  delete: "Xóa (Delete)",
  train_model: "Huấn luyện AI (Train Model)",
  run_churn_intervention: "Chiến dịch Churn AI",
  send_cart_reminders: "Chiến dịch Giỏ hàng",
  update_points: "Thay đổi Điểm (Points)",
};

const RESOURCE_LABELS = {
  all: "Tất cả tài nguyên",
  product: "Sản phẩm (Product)",
  discount: "Mã giảm giá (Discount)",
  category: "Danh mục (Category)",
  user: "Người dùng (User)",
  rewardTier: "Mức đổi thưởng (Reward)",
  ai_model: "Mô hình AI (AI Model)",
  campaign: "Chiến dịch (Campaign)",
};

const ACTION_TONE_CLASS = {
  create: "create",
  update: "update",
  delete: "delete",
  train_model: "create",
  run_churn_intervention: "update",
  send_cart_reminders: "update",
  update_points: "other",
};

const parseUserAgent = (ua) => {
  if (!ua) return "Thiết bị không rõ";
  let os = "Không rõ OS";
  let browser = "Không rõ Trình duyệt";
  
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Trident") || ua.includes("MSIE")) browser = "IE";
  
  return `${os} (${browser})`;
};

function AdminSystemLogsPage() {
  const { auth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasInitializedFilters = useRef(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [actionFilter, setActionFilter] = useState(searchParams.get("action") || "all");
  const [resourceFilter, setResourceFilter] = useState(searchParams.get("resource") || "all");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page") || 1) || 1));

  const [expandedLogs, setExpandedLogs] = useState({});

  useStatusMessageBridge(message, { title: "Log hệ thống" });

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (query.trim()) {
      nextParams.set("q", query.trim());
    }

    if (actionFilter !== "all") {
      nextParams.set("action", actionFilter);
    }

    if (resourceFilter !== "all") {
      nextParams.set("resource", resourceFilter);
    }

    if (page > 1) {
      nextParams.set("page", String(page));
    }

    setSearchParams(nextParams, { replace: true });
  }, [query, actionFilter, resourceFilter, page, setSearchParams]);

  useEffect(() => {
    if (!hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      return;
    }

    setPage(1);
  }, [query, actionFilter, resourceFilter]);

  const loadSystemLogs = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminSystemLogs(auth.token, {
        q: query.trim(),
        action: actionFilter,
        resource: resourceFilter,
        page,
        limit: 20,
      });

      setLogs(data.logs || []);
      setTotal(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.totalPages || 1)));
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể tải log hệ thống."));
    } finally {
      setLoading(false);
    }
  }, [auth?.token, query, actionFilter, resourceFilter, page]);

  useEffect(() => {
    loadSystemLogs();
  }, [loadSystemLogs]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const formatDateTime = useCallback((value) => {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleString("vi-VN");
  }, []);

  const emptyText = useMemo(() => {
    if (loading) {
      return "Đang tải log hệ thống...";
    }

    return "Không có bản ghi phù hợp bộ lọc.";
  }, [loading]);

  const getActionToneClass = useCallback((action) => {
    const key = String(action || "").toLowerCase();
    return ACTION_TONE_CLASS[key] || "other";
  }, []);

  const toggleLogExpand = (logId) => {
    setExpandedLogs((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  return (
    <main className="container page-content">
      <section className="hero-card dashboard-surface admin-page-enter" aria-busy={loading}>
        <div className="dashboard-header-row">
          <div>
            <h2>Log hệ thống</h2>
            <p className="dashboard-subtitle">
              Theo dõi lịch sử thay đổi do admin thực hiện trên hệ thống.
            </p>
          </div>
        </div>

        {message && (
          <p className="form-message" role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div className="system-log-filter-bar">
          <div className="system-log-filter-control">
            <label htmlFor="log-search">Tìm kiếm</label>
            <input
              id="log-search"
              placeholder="Email admin, resourceId, đường dẫn..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="system-log-filter-control">
            <label htmlFor="log-action">Hành động</label>
            <select id="log-action" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
              {ACTION_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {ACTION_LABELS[item] || item}
                </option>
              ))}
            </select>
          </div>

          <div className="system-log-filter-control">
            <label htmlFor="log-resource">Tài nguyên</label>
            <select
              id="log-resource"
              value={resourceFilter}
              onChange={(event) => setResourceFilter(event.target.value)}
            >
              {RESOURCE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {RESOURCE_LABELS[item] || item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="system-log-meta">Tổng bản ghi: {total}</p>

        <div className="dashboard-table-card">
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Admin</th>
                  <th>Hành động</th>
                  <th>Tài nguyên</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((item) => {
                  const isExpanded = !!expandedLogs[item._id];
                  const detailsStr = JSON.stringify(item.details || {});

                  return (
                    <tr key={item._id}>
                      <td>{formatDateTime(item.timestamp)}</td>
                      <td>
                        <div className="cell-title truncate-text" title={item.adminEmail || "-"}>
                          {item.adminEmail || "-"}
                        </div>
                        <div className="cell-subtext" style={{ fontSize: "11px", color: "#64748b" }}>
                          ID: {item.adminId || "-"}
                        </div>
                        <div className="cell-subtext" style={{ fontSize: "11.5px", color: "#475569" }}>
                          IP: {item.ip || "-"}
                        </div>
                        {item.userAgent && (
                          <div
                            className="cell-subtext"
                            title={item.userAgent}
                            style={{
                              fontSize: "11px",
                              color: "#94a3b8",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "180px",
                              marginTop: "2px"
                            }}
                          >
                            OS: {parseUserAgent(item.userAgent)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`pill system-log-action ${getActionToneClass(item.action)}`}>
                          {item.action || "-"}
                        </span>
                      </td>
                      <td>
                        <div className="cell-title">{item.resource || "-"}</div>
                        <div className="cell-subtext">ID: {item.resourceId || "-"}</div>
                      </td>
                      <td className="system-log-details-cell">
                        <div className="system-log-path">
                          <span className={`method-badge ${String(item.method || "OTHER").toLowerCase()}`}>
                            {item.method || "OTHER"}
                          </span>
                          <code className="path-code">{item.path || "-"}</code>
                        </div>
                        <div className="system-log-detail-section">
                          {isExpanded ? (
                            <pre className="system-log-json-block">
                              {JSON.stringify(item.details || {}, null, 2)}
                            </pre>
                          ) : (
                            <div className="system-log-detail-preview" title={detailsStr}>
                              {detailsStr}
                            </div>
                          )}
                          <button
                            type="button"
                            className="btn-toggle-log-detail"
                            onClick={() => toggleLogExpand(item._id)}
                            title={isExpanded ? "Thu gọn chi tiết" : "Xem chi tiết đầy đủ"}
                          >
                            <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
                            <span>{isExpanded ? " Thu gọn" : " Xem chi tiết"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan="5" className="table-empty-cell">
                      {emptyText}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="system-log-pagination">
          <p>
            Trang {page}/{totalPages}
          </p>
          <div className="pagination-actions">
            <button
              type="button"
              className="secondary-btn pager-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <FontAwesomeIcon icon={faChevronLeft} /> Trước
            </button>
            <button
              type="button"
              className="secondary-btn pager-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Sau <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AdminSystemLogsPage;
