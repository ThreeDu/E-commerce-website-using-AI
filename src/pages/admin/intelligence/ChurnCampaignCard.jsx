import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGift, faSync } from "@fortawesome/free-solid-svg-icons";

function ChurnCampaignCard({ churnThreshold, cooldownDays, handleRunChurnCampaign, maxTargets, runningCart, runningChurn, setChurnThreshold, setCooldownDays, setMaxTargets }) {
  return (
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
  );
}

export default ChurnCampaignCard;
