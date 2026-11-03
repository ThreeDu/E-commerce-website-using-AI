import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import {
  getRetentionHistory,
  runRetentionIntervention,
  sendCartReminders,
} from "../../../services/admin/adminIntelligenceService";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBullhorn } from "@fortawesome/free-solid-svg-icons";
import CampaignHistory from "./CampaignHistory";
import CampaignResultPanel from "./CampaignResultPanel";
import AbandonedCartCampaignCard from "./AbandonedCartCampaignCard";
import ChurnCampaignCard from "./ChurnCampaignCard";

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

  // Fetch History
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await getRetentionHistory(auth?.token);
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
      const data = await runRetentionIntervention(auth?.token, {
        churnThreshold,
        cooldownDays,
        maxTargets,
      });

      if (data.success) {
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
      notifyError(err.status ? err.message : "Không thể kết nối Server hoặc ML service.", {
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
      const data = await sendCartReminders(auth?.token, {
        hours: hoursStale,
        includeDiscount: includeCartDiscount,
        discountType: cartDiscountType,
        discountValue: cartDiscountValue,
      });

      if (data.success) {
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
      notifyError(err.status ? err.message : "Không thể kết nối Server hoặc ML service.", {
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
        <ChurnCampaignCard churnThreshold={churnThreshold} cooldownDays={cooldownDays} handleRunChurnCampaign={handleRunChurnCampaign} maxTargets={maxTargets} runningCart={runningCart} runningChurn={runningChurn} setChurnThreshold={setChurnThreshold} setCooldownDays={setCooldownDays} setMaxTargets={setMaxTargets} />

        {/* Campaign 2: Abandoned Cart Recovery */}
        <AbandonedCartCampaignCard cartDiscountType={cartDiscountType} cartDiscountValue={cartDiscountValue} handleRunCartCampaign={handleRunCartCampaign} hoursStale={hoursStale} includeCartDiscount={includeCartDiscount} runningCart={runningCart} runningChurn={runningChurn} setCartDiscountType={setCartDiscountType} setCartDiscountValue={setCartDiscountValue} setHoursStale={setHoursStale} setIncludeCartDiscount={setIncludeCartDiscount} />
      </div>

      {/* Results Panel */}
      <CampaignResultPanel campaignResult={campaignResult} setCampaignResult={setCampaignResult} />

      {/* Campaign Timeline History */}
      <CampaignHistory activePage={activePage} currentHistory={currentHistory} editingEllipsis={editingEllipsis} history={history} indexOfFirstItem={indexOfFirstItem} indexOfLastItem={indexOfLastItem} inputPageValue={inputPageValue} itemsPerPage={itemsPerPage} loadingHistory={loadingHistory} setCurrentPage={setCurrentPage} setEditingEllipsis={setEditingEllipsis} setInputPageValue={setInputPageValue} setItemsPerPage={setItemsPerPage} totalPages={totalPages} />
    </main>
  );
}

export default AdminRetentionCampaignPage;
