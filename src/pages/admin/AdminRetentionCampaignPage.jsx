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
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-admin-ink flex items-center gap-3">
          <FontAwesomeIcon icon={faBullhorn} className="text-[#4f46e5]" />
          Chiến dịch giữ chân khách hàng (Customer Retention)
        </h1>
        <p className="text-admin-muted text-sm md:text-base mt-1.5">
          Quản lý và thực hiện các chiến dịch tự động tương tác, phát voucher giữ chân khách hàng bằng trí tuệ nhân tạo AI.
        </p>
      </div>

      {/* Grid of campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Campaign 1: Churn Intervention */}
        <div className="bg-white rounded-2xl border border-admin-line shadow-xs overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col">
          <div className="p-6 text-white font-semibold text-lg flex items-center gap-2.5 bg-gradient-to-r from-[#ff6b6b] to-[#ff8e53]">
            <FontAwesomeIcon icon={faGift} />
            🔴 Chiến dịch Can thiệp Churn Risk
          </div>
          <div className="p-6 flex flex-col flex-1 gap-5">
            <p className="text-sm leading-relaxed text-admin-muted">
              Hệ thống AI tự động phát hiện những khách hàng có nguy cơ rời bỏ (Churn Risk) dựa trên hoạt động mua sắm, tương tác chatbot, lượt xem sản phẩm. Nhấn nút để gửi thông báo nhắc nhở kèm Voucher giảm giá tối ưu tự động dựa trên CLV của khách hàng.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-admin-ink">Ngưỡng Churn Risk tối thiểu (%)</label>
              <input
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                type="number"
                min="10"
                max="100"
                value={churnThreshold}
                onChange={(e) => setChurnThreshold(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-admin-ink">Tần suất nhận tin nhắn (cooldown ngày)</label>
              <input
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                type="number"
                min="1"
                value={cooldownDays}
                onChange={(e) => setCooldownDays(Number(e.target.value))}
              />
              <span className="text-[11px] text-admin-muted">
                * Chống spam: Mỗi khách nhận tối đa 1 lần trong số ngày này
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-admin-ink">Giới hạn khách hàng can thiệp tối đa</label>
              <input
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                type="number"
                min="1"
                max="100"
                value={maxTargets}
                onChange={(e) => setMaxTargets(Number(e.target.value))}
              />
              <span className="text-[11px] text-admin-muted">
                * Bảo vệ ngân sách voucher (Khuyên dùng tối đa 20 KH)
              </span>
            </div>

            <button
              className="w-full p-3 rounded-xl font-bold text-white cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 mt-auto disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] bg-red-600 hover:bg-red-700"
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
        <div className="bg-white rounded-2xl border border-admin-line shadow-xs overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md flex flex-col">
          <div className="p-6 text-white font-semibold text-lg flex items-center gap-2.5 bg-gradient-to-r from-[#4facfe] to-[#00f2fe]">
            <FontAwesomeIcon icon={faShoppingCart} />
            🛒 Khôi phục giỏ hàng bỏ rơi
          </div>
          <div className="p-6 flex flex-col flex-1 gap-5">
            <p className="text-sm leading-relaxed text-admin-muted">
              Phát hiện giỏ hàng đã lâu không hoạt động (&gt; 24 giờ). Gửi thông báo đẩy nhắc nhở khách hàng hoàn tất giỏ hàng kèm ưu đãi giảm giá nhỏ tăng tỷ lệ chuyển đổi, kích thích thanh toán nhanh chóng.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-admin-ink">Thời gian bỏ rơi tối thiểu (giờ)</label>
              <input
                className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                type="number"
                min="1"
                value={hoursStale}
                onChange={(e) => setHoursStale(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-admin-ink" onClick={() => setIncludeCartDiscount(!includeCartDiscount)}>
              <input
                type="checkbox"
                checked={includeCartDiscount}
                onChange={() => {}}
                className="cursor-pointer"
              />
              <span>Tặng mã giảm giá kích cầu</span>
            </div>

            {includeCartDiscount && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-admin-ink">Loại Voucher</label>
                  <select
                    className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled cursor-pointer"
                    value={cartDiscountType}
                    onChange={(e) => setCartDiscountType(e.target.value)}
                  >
                    <option value="percent">Phần trăm (%)</option>
                    <option value="fixed">Số tiền cố định (đ)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-admin-ink">Giá trị</label>
                  <input
                    className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                    type="number"
                    min="1"
                    value={cartDiscountValue}
                    onChange={(e) => setCartDiscountValue(Number(e.target.value))}
                  />
                </div>
              </div>
            )}

            <button
              className="w-full p-3 rounded-xl font-bold text-white cursor-pointer transition-all duration-150 flex items-center justify-center gap-2 mt-auto disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] bg-[#0284c7] hover:bg-[#0369a1]"
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
        <div className="bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] p-6 mb-8 shadow-xs animate-fade-in">
          <div className="flex justify-between items-center mb-5 border-b border-[#e2e8f0] pb-3">
            <h2 className="text-base md:text-lg font-bold text-admin-ink flex items-center gap-2">
              <FontAwesomeIcon icon={faUserTag} className="text-[#6366f1]" />
              Kết quả chiến dịch vừa thực hiện
            </h2>
            <button className="bg-transparent border-none text-admin-muted text-lg cursor-pointer hover:text-admin-ink transition-colors" onClick={() => setCampaignResult(null)}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="flex gap-5 mb-5">
            <div className="bg-white border border-[#e2e8f0] p-3 px-5 rounded-xl flex flex-col shadow-xs">
              <span className="text-2xl font-bold text-[#6366f1]">
                {campaignResult.campaignType === "churn_intervention"
                  ? campaignResult.targetsCount
                  : campaignResult.remindersSent}
              </span>
              <span className="text-xs text-admin-muted mt-1 font-semibold">Khách hàng được tiếp cận</span>
            </div>
            <div className="bg-white border border-[#e2e8f0] p-3 px-5 rounded-xl flex flex-col shadow-xs">
              <span className="text-2xl font-bold text-amber-600">
                {campaignResult.vouchersCreated}
              </span>
              <span className="text-xs text-admin-muted mt-1 font-semibold">Voucher phát thành công</span>
            </div>
          </div>

          <h3 className="text-[14px] font-bold text-admin-ink mb-3">
            Danh sách khách hàng trong chiến dịch:
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="[&>th]:p-3 [&>th]:bg-[#f1f5f9] [&>th]:font-semibold [&>th]:text-xs [&>th]:text-admin-muted [&>th]:uppercase [&>th]:border-b-2 [&>th]:border-admin-line">
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
              <tbody className="divide-y divide-admin-line">
                {campaignResult.results.map((r, idx) => (
                  <tr key={idx} className="hover:bg-[#f8fafc] [&>td]:p-3 [&>td]:text-admin-ink">
                    <td><strong>{r.userName}</strong></td>
                    <td>{r.email}</td>
                    {campaignResult.campaignType === "churn_intervention" ? (
                      <>
                        <td><span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-600">{r.churnScore}%</span></td>
                        <td><span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-sky-100 text-sky-700">{r.clvScore}</span></td>
                        <td><span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600">{r.segment}</span></td>
                      </>
                    ) : (
                      <>
                        <td>{r.hoursAbandoned} giờ</td>
                        <td>{r.estimatedValue.toLocaleString("vi-VN")} đ</td>
                        <td><span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700">{r.priorityScore}</span></td>
                      </>
                    )}
                    <td>
                      {r.voucherCode ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700 border border-dashed border-amber-400">{r.voucherCode}</span>
                      ) : (
                        <span className="text-admin-muted text-xs">— (Chỉ nhắc nhở)</span>
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
      <div className="bg-white rounded-2xl border border-admin-line shadow-xs p-6">
        <h2 className="text-lg md:text-xl font-bold text-admin-ink mb-5 flex items-center gap-2">
          <FontAwesomeIcon icon={faHistory} className="text-[#4f46e5]" />
          Lịch sử chiến dịch giữ chân khách hàng (Campaign Logs)
        </h2>

        {loadingHistory ? (
          <p className="text-center py-6 text-admin-muted font-medium">
            Đang tải lịch sử...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="[&>th]:p-3 [&>th]:bg-[#f1f5f9] [&>th]:font-semibold [&>th]:text-xs [&>th]:text-admin-muted [&>th]:uppercase [&>th]:border-b-2 [&>th]:border-admin-line">
                  <th>Thời gian</th>
                  <th>Chiến dịch</th>
                  <th>Khách hàng nhận</th>
                  <th>Nội dung thông báo gửi đi</th>
                  <th>Mã Voucher tặng kèm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {currentHistory.map((item) => (
                  <tr key={item._id} className="hover:bg-[#f8fafc] [&>td]:p-3 [&>td]:text-admin-ink">
                    <td className="whitespace-nowrap">
                      <FontAwesomeIcon icon={faClock} className="mr-1.5 text-[#94a3b8]" />
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${item.type === "churn_intervention" ? "bg-red-100 text-red-600" : "bg-sky-100 text-sky-700"}`}>
                        {item.type === "churn_intervention" ? "Can thiệp Churn" : "Nhắc nhở giỏ hàng"}
                      </span>
                    </td>
                    <td>
                      {item.user ? (
                        <div>
                          <strong>{item.user.name}</strong>
                          <br />
                          <span className="text-xs text-admin-muted">{item.user.email}</span>
                        </div>
                      ) : (
                        <span className="text-red-600 text-xs font-bold">
                          <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> Khách đã xóa
                        </span>
                      )}
                    </td>
                    <td className="max-w-[350px] text-xs text-[#475569] leading-relaxed">{item.message}</td>
                    <td>
                      {item.data?.voucherCode ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700 border border-dashed border-amber-400">{item.data.voucherCode}</span>
                      ) : (
                        <span className="text-admin-muted text-xs">— (Không tặng mã)</span>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-6 text-admin-muted">
                      Chưa có chiến dịch giữ chân nào được thực hiện.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 0 && history.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 mt-4 border-t border-admin-line">
                <div className="text-[13.5px] text-admin-muted font-medium">
                  Hiển thị {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, history.length)} trong tổng số {history.length} bản ghi
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
                      className="p-1 border border-admin-line rounded-lg bg-white focus:outline-none cursor-pointer"
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
                      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      onClick={() => setCurrentPage(1)}
                      disabled={activePage === 1}
                      title="Trang đầu"
                    >
                      <FontAwesomeIcon icon={faAngleDoubleLeft} />
                    </button>

                    {/* Previous Page */}
                    <button
                      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
                              className="inline-flex items-center justify-center w-[50px] h-9 px-1 rounded-xl border border-admin-primary bg-white text-admin-ink text-center text-[13px] font-bold outline-none"
                            />
                          );
                        }
                        return (
                          <button
                            key={`dots-${index}`}
                            type="button"
                            className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#94a3b8] text-[13px] font-bold cursor-pointer hover:bg-[#eef4fb]"
                            onClick={() => {
                              setEditingEllipsis(item.id);
                              setInputPageValue("");
                            }}
                            title="Nhấp để nhập số trang mong muốn"
                          >
                            ...
                          </button>
                        );
                      }
                      return (
                        <button
                          key={item.value}
                          className={`inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border text-[13px] font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px ${
                            activePage === item.value
                              ? "bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] border-transparent text-white shadow-md hover:translate-y-0"
                              : "border-admin-line bg-white text-[#5f6f85] hover:bg-[#eef4fb]"
                          }`}
                          onClick={() => setCurrentPage(item.value)}
                        >
                          {item.value}
                        </button>
                      );
                    })}

                    {/* Next Page */}
                    <button
                      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={activePage === totalPages}
                      title="Trang sau"
                    >
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>

                    {/* Last Page */}
                    <button
                      className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
