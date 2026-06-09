import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGift,
  faShoppingCart,
  faBullhorn,
  faHistory,
  faSync,
  faEnvelope,
  faTimes,
  faExclamationTriangle,
  faUserTag,
  faClock,
  faChevronLeft,
  faChevronRight,
  faAngleDoubleLeft,
  faAngleDoubleRight,
} from "@fortawesome/free-solid-svg-icons";
import "../../css/admin/retention-campaign.css";

const API_BASE = "/api/auth/admin/intelligence/retention";

function AdminRetentionCampaignPage() {
  const { auth } = useAuth();
  const { success, error: notifyError } = useNotification();

  // Campaign configurations
  const [churnThreshold, setChurnThreshold] = useState(50);
  const [cooldownDays, setCooldownDays] = useState(7);
  const [maxTargets, setMaxTargets] = useState(20);

  const [hoursStale, setHoursStale] = useState(24);
  const [includeCartDiscount, setIncludeCartDiscount] = useState(true);
  const [cartDiscountType, setCartDiscountType] = useState("percent");
  const [cartDiscountValue, setCartDiscountValue] = useState(10);

  // Loading & process states
  const [runningChurn, setRunningChurn] = useState(false);
  const [runningCart, setRunningCart] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Data states
  const [campaignResult, setCampaignResult] = useState(null);
  const [history, setHistory] = useState([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingEllipsis, setEditingEllipsis] = useState(null); // 'left' or 'right' or null
  const [inputPageValue, setInputPageValue] = useState("");

  const totalPages = Math.ceil(history.length / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const indexOfLastItem = activePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentHistory = history.slice(indexOfFirstItem, indexOfLastItem);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push({ type: "page", value: i });
      }
    } else {
      if (activePage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push({ type: "page", value: i });
        }
        pages.push({ type: "ellipsis", id: "right" });
        pages.push({ type: "page", value: totalPages });
      } else if (activePage >= totalPages - 3) {
        pages.push({ type: "page", value: 1 });
        pages.push({ type: "ellipsis", id: "left" });
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push({ type: "page", value: i });
        }
      } else {
        pages.push({ type: "page", value: 1 });
        pages.push({ type: "ellipsis", id: "left" });
        pages.push({ type: "page", value: activePage - 1 });
        pages.push({ type: "page", value: activePage });
        pages.push({ type: "page", value: activePage + 1 });
        pages.push({ type: "ellipsis", id: "right" });
        pages.push({ type: "page", value: totalPages });
      }
    }
    return pages;
  };

  // Fetch History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/history`, {
        headers: { Authorization: `Bearer ${auth?.token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      }
    } catch (err) {
      console.error("Error fetching campaign history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Run Churn Campaign
  const handleRunChurnCampaign = async () => {
    setRunningChurn(true);
    setCampaignResult(null);
    try {
      const res = await fetch(`${API_BASE}/run-intervention`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.token}`,
        },
        body: JSON.stringify({
          churnThreshold,
          cooldownDays,
          maxTargets,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        success(
          `Đã chạy chiến dịch can thiệp thành công! Can thiệp ${data.targetsCount} KH. Tạo ${data.vouchersCreated} voucher.`,
          { title: "Can thiệp Churn AI" }
        );
        setCampaignResult(data);
        await fetchHistory();
        setCurrentPage(1);
      } else {
        notifyError(data.message || "Chạy chiến dịch can thiệp thất bại.", {
          title: "Can thiệp Churn AI",
        });
      }
    } catch (err) {
      notifyError("Không thể kết nối Server hoặc ML service.", {
        title: "Can thiệp Churn AI",
      });
    } finally {
      setRunningChurn(false);
    }
  };

  // Run Cart Campaign
  const handleRunCartCampaign = async () => {
    setRunningCart(true);
    setCampaignResult(null);
    try {
      const res = await fetch(`${API_BASE}/send-cart-reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth?.token}`,
        },
        body: JSON.stringify({
          hours: hoursStale,
          includeDiscount: includeCartDiscount,
          discountType: cartDiscountType,
          discountValue: cartDiscountValue,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        success(
          `Đã gửi nhắc nhở giỏ hàng thành công! Gửi ${data.remindersSent} thông báo. Tạo ${data.vouchersCreated} voucher.`,
          { title: "Khôi phục giỏ hàng" }
        );
        setCampaignResult(data);
        await fetchHistory();
        setCurrentPage(1);
      } else {
        notifyError(data.message || "Gửi nhắc nhở giỏ hàng thất bại.", {
          title: "Khôi phục giỏ hàng",
        });
      }
    } catch (err) {
      notifyError("Không thể kết nối Server hoặc ML service.", {
        title: "Khôi phục giỏ hàng",
      });
    } finally {
      setRunningCart(false);
    }
  };

  return (
    <main className="container page-content retention-page">
      {/* Header */}
      <div className="retention-header">
        <h1 className="retention-title">
          <FontAwesomeIcon icon={faBullhorn} style={{ color: "#4f46e5" }} />
          Chiến dịch giữ chân khách hàng (Customer Retention)
        </h1>
        <p className="retention-subtitle">
          Quản lý và thực hiện các chiến dịch tự động tương tác, phát voucher giữ chân khách hàng bằng trí tuệ nhân tạo AI.
        </p>
      </div>

      {/* Grid of campaigns */}
      <div className="retention-grid">
        {/* Campaign 1: Churn Intervention */}
        <div className="retention-card">
          <div className="retention-card__banner retention-card__banner--churn">
            <FontAwesomeIcon icon={faGift} />
            🔴 Chiến dịch Can thiệp Churn Risk
          </div>
          <div className="retention-card__content">
            <p className="retention-card__desc">
              Hệ thống AI tự động phát hiện những khách hàng có nguy cơ rời bỏ (Churn Risk) dựa trên hoạt động mua sắm, tương tác chatbot, lượt xem sản phẩm. Nhấn nút để gửi thông báo nhắc nhở kèm Voucher giảm giá tối ưu tự động dựa trên CLV của khách hàng.
            </p>

            <div className="retention-form-group">
              <label className="retention-form-label">Ngưỡng Churn Risk tối thiểu (%)</label>
              <input
                className="retention-input"
                type="number"
                min="10"
                max="100"
                value={churnThreshold}
                onChange={(e) => setChurnThreshold(Number(e.target.value))}
              />
            </div>

            <div className="retention-form-group">
              <label className="retention-form-label">Tần suất nhận tin nhắn (cooldown ngày)</label>
              <input
                className="retention-input"
                type="number"
                min="1"
                value={cooldownDays}
                onChange={(e) => setCooldownDays(Number(e.target.value))}
              />
              <span style={{ fontSize: "11px", color: "var(--retention-text-muted)" }}>
                * Chống spam: Mỗi khách nhận tối đa 1 lần trong số ngày này
              </span>
            </div>

            <div className="retention-form-group">
              <label className="retention-form-label">Giới hạn khách hàng can thiệp tối đa</label>
              <input
                className="retention-input"
                type="number"
                min="1"
                max="100"
                value={maxTargets}
                onChange={(e) => setMaxTargets(Number(e.target.value))}
              />
              <span style={{ fontSize: "11px", color: "var(--retention-text-muted)" }}>
                * Bảo vệ ngân sách voucher (Khuyên dùng tối đa 20 KH)
              </span>
            </div>

            <button
              className="retention-button retention-button--churn"
              disabled={runningChurn || runningCart}
              onClick={handleRunChurnCampaign}
            >
              {runningChurn ? (
                <>
                  <FontAwesomeIcon icon={faSync} spin />
                  Đang chạy chiến dịch...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faGift} />
                  Chạy Chiến Dịch Can Thiệp Churn
                </>
              )}
            </button>
          </div>
        </div>

        {/* Campaign 2: Abandoned Cart Recovery */}
        <div className="retention-card">
          <div className="retention-card__banner retention-card__banner--cart">
            <FontAwesomeIcon icon={faShoppingCart} />
            🛒 Khôi phục giỏ hàng bỏ rơi
          </div>
          <div className="retention-card__content">
            <p className="retention-card__desc">
              Phát hiện giỏ hàng đã lâu không hoạt động (&gt; 24 giờ). Gửi thông báo đẩy nhắc nhở khách hàng hoàn tất giỏ hàng kèm ưu đãi giảm giá nhỏ tăng tỷ lệ chuyển đổi, kích thích thanh toán nhanh chóng.
            </p>

            <div className="retention-form-group">
              <label className="retention-form-label">Thời gian bỏ rơi tối thiểu (giờ)</label>
              <input
                className="retention-input"
                type="number"
                min="1"
                value={hoursStale}
                onChange={(e) => setHoursStale(Number(e.target.value))}
              />
            </div>

            <div className="retention-checkbox-container" onClick={() => setIncludeCartDiscount(!includeCartDiscount)}>
              <input
                type="checkbox"
                checked={includeCartDiscount}
                onChange={() => {}}
                style={{ cursor: "pointer" }}
              />
              <span>Tặng mã giảm giá kích cầu</span>
            </div>

            {includeCartDiscount && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="retention-form-group">
                  <label className="retention-form-label">Loại Voucher</label>
                  <select
                    className="retention-input"
                    value={cartDiscountType}
                    onChange={(e) => setCartDiscountType(e.target.value)}
                  >
                    <option value="percent">Phần trăm (%)</option>
                    <option value="fixed">Số tiền cố định (đ)</option>
                  </select>
                </div>
                <div className="retention-form-group">
                  <label className="retention-form-label">Giá trị</label>
                  <input
                    className="retention-input"
                    type="number"
                    min="1"
                    value={cartDiscountValue}
                    onChange={(e) => setCartDiscountValue(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <button
              className="retention-button retention-button--cart"
              disabled={runningCart || runningChurn}
              onClick={handleRunCartCampaign}
            >
              {runningCart ? (
                <>
                  <FontAwesomeIcon icon={faSync} spin />
                  Đang gửi nhắc nhở...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faEnvelope} />
                  Gửi Nhắc Nhở Giỏ Hàng Bỏ Rơi
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Panel */}
      {campaignResult && (
        <div className="retention-results">
          <div className="retention-results__header">
            <h2 className="retention-results__title">
              <FontAwesomeIcon icon={faUserTag} style={{ color: "var(--retention-primary)" }} />
              Kết quả chiến dịch vừa thực hiện
            </h2>
            <button className="retention-results__close" onClick={() => setCampaignResult(null)}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="retention-results__summary">
            <div className="retention-results__stat">
              <span className="retention-results__stat-val">
                {campaignResult.campaignType === "churn_intervention"
                  ? campaignResult.targetsCount
                  : campaignResult.remindersSent}
              </span>
              <span className="retention-results__stat-label">Khách hàng được tiếp cận</span>
            </div>
            <div className="retention-results__stat">
              <span className="retention-results__stat-val" style={{ color: "#d97706" }}>
                {campaignResult.vouchersCreated}
              </span>
              <span className="retention-results__stat-label">Voucher phát thành công</span>
            </div>
          </div>

          <h3 style={{ fontSize: "15px", fontWeight: "600", color: "#334155", marginBottom: "12px" }}>
            Danh sách khách hàng trong chiến dịch:
          </h3>
          <div className="retention-table-container">
            <table className="retention-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Email</th>
                  {campaignResult.campaignType === "churn_intervention" ? (
                    <>
                      <th>Churn Risk</th>
                      <th>CLV Score</th>
                      <th>Phân Phân khúc</th>
                    </>
                  ) : (
                    <>
                      <th>Giờ bỏ rơi</th>
                      <th>Giá trị giỏ</th>
                      <th>Priority</th>
                    </>
                  )}
                  <th>Mã giảm giá tặng kèm</th>
                </tr>
              </thead>
              <tbody>
                {campaignResult.results.map((r, idx) => (
                  <tr key={idx}>
                    <td><strong>{r.userName}</strong></td>
                    <td>{r.email}</td>
                    {campaignResult.campaignType === "churn_intervention" ? (
                      <>
                        <td><span className="retention-badge" style={{ backgroundColor: "#fee2e2", color: "#ef4444" }}>{r.churnScore}%</span></td>
                        <td><span className="retention-badge" style={{ backgroundColor: "#e0f2fe", color: "#0284c7" }}>{r.clvScore}</span></td>
                        <td><span className="retention-badge" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>{r.segment}</span></td>
                      </>
                    ) : (
                      <>
                        <td>{r.hoursAbandoned} giờ</td>
                        <td>{r.estimatedValue.toLocaleString("vi-VN")} đ</td>
                        <td><span className="retention-badge" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>{r.priorityScore}</span></td>
                      </>
                    )}
                    <td>
                      {r.voucherCode ? (
                        <span className="retention-badge retention-badge--voucher">{r.voucherCode}</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>— (Chỉ nhắc nhở)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Campaign Timeline History */}
      <div className="retention-history-card">
        <h2 className="retention-history-title">
          <FontAwesomeIcon icon={faHistory} style={{ color: "#4f46e5" }} />
          Lịch sử chiến dịch giữ chân khách hàng (Campaign Logs)
        </h2>

        {loadingHistory ? (
          <p style={{ textAlign: "center", padding: "24px", color: "var(--retention-text-muted)" }}>
            Đang tải lịch sử...
          </p>
        ) : (
          <div className="retention-table-container">
            <table className="retention-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Chiến dịch</th>
                  <th>Khách hàng nhận</th>
                  <th>Nội dung thông báo gửi đi</th>
                  <th>Mã Voucher tặng kèm</th>
                </tr>
              </thead>
              <tbody>
                {currentHistory.map((item) => (
                  <tr key={item._id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <FontAwesomeIcon icon={faClock} style={{ marginRight: "6px", color: "#94a3b8" }} />
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td>
                      <span className={`retention-badge ${item.type === "churn_intervention" ? "retention-badge--churn" : "retention-badge--cart"}`}>
                        {item.type === "churn_intervention" ? "Can thiệp Churn" : "Nhắc nhở giỏ hàng"}
                      </span>
                    </td>
                    <td>
                      {item.user ? (
                        <div>
                          <strong>{item.user.name}</strong>
                          <br />
                          <span style={{ fontSize: "11px", color: "var(--retention-text-muted)" }}>{item.user.email}</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--retention-danger)" }}>
                          <FontAwesomeIcon icon={faExclamationTriangle} /> Khách đã xóa
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: "350px", fontSize: "13px", color: "#475569" }}>{item.message}</td>
                    <td>
                      {item.data?.voucherCode ? (
                        <span className="retention-badge retention-badge--voucher">{item.data.voucherCode}</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>— (Không tặng mã)</span>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>
                      Chưa có chiến dịch giữ chân nào được thực hiện.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 0 && history.length > 0 && (
              <div className="retention-pagination-container">
                <div className="retention-pagination-info">
                  Hiển thị {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, history.length)} trong tổng số {history.length} bản ghi
                </div>

                <div className="retention-pagination-right">
                  {/* Page Size Selector */}
                  <div className="retention-page-size-selector">
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
                  <div className="retention-pagination-pages">
                    {/* First Page */}
                    <button
                      className="retention-pagination-btn"
                      onClick={() => setCurrentPage(1)}
                      disabled={activePage === 1}
                      title="Trang đầu"
                    >
                      <FontAwesomeIcon icon={faAngleDoubleLeft} />
                    </button>

                    {/* Previous Page */}
                    <button
                      className="retention-pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={activePage === 1}
                      title="Trang trước"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>

                    {/* Page Numbers */}
                    {getPageNumbers().map((item, index) => {
                      if (item.type === "ellipsis") {
                        if (editingEllipsis === item.id) {
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
                              className="retention-pagination-btn"
                              style={{
                                width: "50px",
                                height: "36px",
                                padding: "0",
                                textAlign: "center",
                                border: "1px solid var(--retention-primary, #6366f1)",
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
                            key={`dots-${index}`}
                            type="button"
                            className="retention-pagination-btn"
                            onClick={() => {
                              setEditingEllipsis(item.id);
                              setInputPageValue("");
                            }}
                            title="Nhấp để nhập số trang mong muốn"
                            style={{ cursor: "pointer", color: "#94a3b8", fontWeight: "bold" }}
                          >
                            ...
                          </button>
                        );
                      }
                      return (
                        <button
                          key={item.value}
                          className={`retention-pagination-btn ${
                            activePage === item.value ? "retention-pagination-btn--active" : ""
                          }`}
                          onClick={() => setCurrentPage(item.value)}
                        >
                          {item.value}
                        </button>
                      );
                    })}

                    {/* Next Page */}
                    <button
                      className="retention-pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage === totalPages}
                      title="Trang sau"
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>

                    {/* Last Page */}
                    <button
                      className="retention-pagination-btn"
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
        )}
      </div>
    </main>
  );
}

export default AdminRetentionCampaignPage;
