import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShoppingCart, faSync, faEnvelope } from "@fortawesome/free-solid-svg-icons";

function AbandonedCartCampaignCard({ cartDiscountType, cartDiscountValue, handleRunCartCampaign, hoursStale, includeCartDiscount, runningCart, runningChurn, setCartDiscountType, setCartDiscountValue, setHoursStale, setIncludeCartDiscount }) {
  return (
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
  );
}

export default AbandonedCartCampaignCard;
