function RedeemPointsModal({ handleRedeem, isRedeemModalOpen, isRedeeming, loyaltyPoints, pointHistory, rewardTiers, setIsRedeemModalOpen }) {
  if (!isRedeemModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9999] p-5">
      <div className="bg-white rounded-2xl w-full max-w-[520px] p-6 shadow-xl border border-[#e2e8f0] animate-fade-in">
        <div className="flex justify-between items-center p-6 border-b border-[#f1f5f9]">
          <h3 className="m-0 text-xl font-extrabold text-[#0f172a]">Đổi điểm lấy Voucher</h3>
          <button type="button" className="w-8 h-8 rounded bg-[#f1f5f9] border-none text-[#64748b] text-[1.2rem] cursor-pointer transition-all flex items-center justify-center hover:bg-[#e2e8f0] hover:text-[#0f172a]" onClick={() => setIsRedeemModalOpen(false)}>
            ✕
          </button>
        </div>

        <div className="text-center py-4.5 border-b border-[#e2eaf4] mb-4">
          <p className="m-0 mb-1 text-[0.9rem] text-[#62728a]">Số dư hiện tại</p>
          <strong className="text-[2rem] text-profile-primary">{loyaltyPoints.toLocaleString("vi-VN")}</strong>
          <span className="text-[1rem] text-[#62728a] ml-1.5">điểm</span>
        </div>

        <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
          {rewardTiers.length === 0 ? (
            <p className="text-center py-6 text-[#6b7280] text-sm">Chưa có mức đổi thưởng nào. Vui lòng quay lại sau.</p>
          ) : (
            rewardTiers.map(tier => {
              const canRedeem = loyaltyPoints >= tier.pointsRequired;
              const missingPoints = tier.pointsRequired - loyaltyPoints;

              return (
                <div key={tier._id} className={`border rounded-lg p-3 flex justify-between items-center transition-all ${
                  canRedeem 
                    ? "border-[#b5ccf0] bg-[#f8fbff] opacity-100" 
                    : "border-dashed border-[#e2eaf4] bg-[#f8f9fa] opacity-70"
                }`}>
                  <div>
                    <h4 className={`m-0 mb-1 font-bold ${canRedeem ? "text-profile-primary" : "text-[#888]"}`}>{tier.name}</h4>
                    <p className="m-0 text-[0.85rem] text-[#62728a]">
                      {tier.pointsRequired.toLocaleString("vi-VN")} điểm →{" "}
                      Giảm {tier.discountType === "percent" ? `${tier.discountValue}%` : `${Number(tier.discountValue).toLocaleString("vi-VN")}đ`}
                      {Number(tier.maxDiscountValue) > 0 && ` (tối đa ${Number(tier.maxDiscountValue).toLocaleString("vi-VN")}đ)`}
                    </p>
                    {Number(tier.minOrderValue) > 0 && (
                      <p className="mt-0.5 text-[0.8rem] text-[#888]">
                        Đơn tối thiểu {Number(tier.minOrderValue).toLocaleString("vi-VN")}đ · Hiệu lực {tier.voucherValidDays} ngày
                      </p>
                    )}
                    {!canRedeem && (
                      <p className="mt-1 text-[0.8rem] text-[#b42318] font-semibold">
                        Còn thiếu {missingPoints.toLocaleString("vi-VN")} điểm
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!canRedeem || isRedeeming}
                    className="px-4 py-2 text-[0.85rem] rounded-md whitespace-nowrap font-bold transition-all bg-profile-primary text-white hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#9ca3af] disabled:shadow-none disabled:transform-none"
                    onClick={() => handleRedeem(tier._id)}
                  >
                    {isRedeeming ? "Đang đổi..." : "Đổi ngay"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {pointHistory.length > 0 && (
          <div className="mt-5 border-t border-[#e2eaf4] pt-4">
            <h4 className="m-0 mb-2.5 text-[0.9rem] text-[#62728a]">Lịch sử gần đây</h4>
            <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
              {pointHistory.slice(0, 8).map(h => (
                <div key={h._id} className="flex justify-between text-[0.82rem] py-1">
                  <span className="text-[#62728a]">{h.reason}</span>
                  <span className={`font-bold ${h.amount >= 0 ? "text-[#166534]" : "text-[#b42318]"}`}>
                    {h.amount >= 0 ? "+" : ""}{h.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-5">
          <button
            type="button"
            onClick={() => setIsRedeemModalOpen(false)}
            className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-[#f3f4f6] text-[#1f2937] border border-[#e5e7eb] hover:bg-[#e5e7eb] w-full"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default RedeemPointsModal;
