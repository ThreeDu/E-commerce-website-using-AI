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

const ACTION_TONE_CLASSES = {
  create: "text-[#166534] bg-[#e7f9ef]",
  update: "text-[#1d4ed8] bg-[#e8f1ff]",
  delete: "text-[#b42318] bg-[#ffe8e8]",
  other: "text-[#475569] bg-[#e8edf3]",
};

const METHOD_BADGE_CLASSES = {
  get: "bg-[#e8edf3] text-[#475569]",
  post: "bg-[#e7f9ef] text-[#166534]",
  put: "bg-[#e8f1ff] text-[#1d4ed8]",
  patch: "bg-[#e8f1ff] text-[#1d4ed8]",
  delete: "bg-[#ffe8e8] text-[#b42318]",
  other: "bg-[#faf5ff] text-[#6b21a8]",
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
    const tone = ACTION_TONE_CLASS[key] || "other";
    return ACTION_TONE_CLASSES[tone];
  }, []);

  const getMethodBadgeClass = useCallback((method) => {
    const key = String(method || "OTHER").toLowerCase();
    return METHOD_BADGE_CLASSES[key] || METHOD_BADGE_CLASSES.other;
  }, []);

  const toggleLogExpand = (logId) => {
    setExpandedLogs((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  return (
    <main className="w-full max-w-[1100px] mx-auto px-4 md:px-0 flex-1 py-10">
      <section className="bg-admin-surface border border-admin-line rounded-3xl shadow-admin p-6 md:p-8 flex flex-col gap-6 animate-admin-rise bg-[radial-gradient(circle_at_88%_-8%,rgba(255,111,60,0.12),transparent_36%),radial-gradient(circle_at_-8%_100%,rgba(15,118,110,0.1),transparent_30%),#ffffff]" aria-busy={loading}>
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 pb-2">
          <div>
            <h2 className="text-2xl font-extrabold text-admin-ink tracking-tight">Log hệ thống</h2>
            <p className="text-sm text-admin-muted mt-1">
              Theo dõi lịch sử thay đổi do admin thực hiện trên hệ thống.
            </p>
          </div>
        </div>

        {message && (
          <p className="p-2.5 px-3 border border-orange-200 bg-[var(--color-admin-accent-soft)] text-[#9a3412] rounded-xl text-sm mb-4" role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-search" className="text-[11px] font-bold text-admin-muted uppercase tracking-wider">Tìm kiếm</label>
            <input
              id="log-search"
              placeholder="Email admin, resourceId, đường dẫn..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-action" className="text-[11px] font-bold text-admin-muted uppercase tracking-wider">Hành động</label>
            <select
              id="log-action"
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
            >
              {ACTION_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {ACTION_LABELS[item] || item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="log-resource" className="text-[11px] font-bold text-admin-muted uppercase tracking-wider">Tài nguyên</label>
            <select
              id="log-resource"
              value={resourceFilter}
              onChange={(event) => setResourceFilter(event.target.value)}
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
            >
              {RESOURCE_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {RESOURCE_LABELS[item] || item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm font-semibold text-admin-muted -mb-2">Tổng bản ghi: {total}</p>

        <div className="border border-[#dde7f3] rounded-2xl overflow-hidden bg-white w-full max-w-full shadow-xs">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed bg-white">
              <thead>
                <tr className="bg-[#f2f7ff] text-[#4a5c75] [&>th]:p-3 [&>th]:font-bold [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider [&>th]:border-b [&>th]:border-admin-line">
                  <th className="w-[15%]">Thời gian</th>
                  <th className="w-[22%]">Admin</th>
                  <th className="w-[15%]">Hành động</th>
                  <th className="w-[18%]">Tài nguyên</th>
                  <th className="w-[30%]">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {logs.map((item) => {
                  const isExpanded = !!expandedLogs[item._id];
                  const detailsStr = JSON.stringify(item.details || {});

                  return (
                    <tr key={item._id} className="transition-colors hover:bg-[#f8fbff] [&>td]:p-3 [&>td]:align-middle">
                      <td className="text-sm font-semibold text-admin-ink">{formatDateTime(item.timestamp)}</td>
                      <td>
                        <div className="font-semibold text-admin-ink text-sm truncate" title={item.adminEmail || "-"}>
                          {item.adminEmail || "-"}
                        </div>
                        <div className="text-[11px] text-[#64748b] mt-0.5 block truncate">
                          ID: {item.adminId || "-"}
                        </div>
                        <div className="text-[11.5px] text-[#475569] mt-0.5 block truncate">
                          IP: {item.ip || "-"}
                        </div>
                        {item.userAgent && (
                          <div
                            className="text-[11px] text-[#94a3b8] truncate max-w-[180px] mt-0.5 block"
                            title={item.userAgent}
                          >
                            OS: {parseUserAgent(item.userAgent)}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-transparent ${getActionToneClass(item.action)}`}>
                          {item.action || "-"}
                        </span>
                      </td>
                      <td>
                        <div className="font-semibold text-admin-ink text-sm truncate" title={item.resource || "-"}>
                          {item.resource || "-"}
                        </div>
                        <div className="text-xs text-admin-muted truncate mt-0.5" title={item.resourceId || "-"}>
                          ID: {item.resourceId || "-"}
                        </div>
                      </td>
                      <td className="max-w-[420px] min-w-[280px] !align-top">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5 font-sans">
                          <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${getMethodBadgeClass(item.method)}`}>
                            {item.method || "OTHER"}
                          </span>
                          <code className="font-mono text-xs text-[#0f3f84] break-all whitespace-pre-wrap bg-[#f1f5f9] px-1.5 py-0.5 rounded border border-[#e2e8f0]">
                            {item.path || "-"}
                          </code>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1">
                          {isExpanded ? (
                            <pre className="font-mono text-[11.5px] text-[#1e293b] bg-[#f8fafc] p-2.5 rounded-lg border border-[#e2e8f0] max-h-[250px] overflow-y-auto whitespace-pre-wrap break-all m-0 leading-[1.4] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] scrollbar-thin">
                              {JSON.stringify(item.details || {}, null, 2)}
                            </pre>
                          ) : (
                            <div className="font-mono text-xs text-[#52637a] truncate max-w-full bg-[#fafafa] py-1.25 px-2 rounded-md border border-[#f0f0f0]" title={detailsStr}>
                              {detailsStr}
                            </div>
                          )}
                          <button
                            type="button"
                            className="self-start bg-transparent border-0 text-[#1d4ed8] text-[11.5px] font-semibold cursor-pointer py-1 px-2 rounded flex items-center gap-1.5 transition-all duration-200 hover:bg-[#f0f6ff] hover:text-[#1e40af]"
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
                    <td colSpan="5" className="text-center py-8 text-admin-muted font-medium">
                      {emptyText}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-3">
          <p className="m-0 text-sm font-semibold text-admin-muted">
            Trang {page}/{totalPages}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-[7px] rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed gap-1.5"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <FontAwesomeIcon icon={faChevronLeft} /> Trước
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-[7px] rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed gap-1.5"
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
