import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faUserTag } from "@fortawesome/free-solid-svg-icons";
import { formatPrice } from "../../../utils/priceUtils";

function CampaignResultPanel({ campaignResult, setCampaignResult }) {
  if (!campaignResult) {
    return null;
  }

  return (
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
                    <td>{formatPrice(r.estimatedValue)}</td>
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
  );
}

export default CampaignResultPanel;
