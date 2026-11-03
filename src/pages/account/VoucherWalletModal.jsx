function VoucherWalletModal({ isVoucherModalOpen, setIsVoucherModalOpen, success, vouchers }) {
  if (!isVoucherModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9999] p-5">
      <div className="bg-white rounded-2xl w-full max-w-[500px] p-6 shadow-xl border border-[#e2e8f0] animate-fade-in">
        <div className="flex justify-between items-center p-6 border-b border-[#f1f5f9]">
          <h3 className="m-0 text-xl font-extrabold text-[#0f172a]">Ví Voucher của bạn</h3>
          <button type="button" className="w-8 h-8 rounded bg-[#f1f5f9] border-none text-[#64748b] text-[1.2rem] cursor-pointer transition-all flex items-center justify-center hover:bg-[#e2e8f0] hover:text-[#0f172a]" onClick={() => setIsVoucherModalOpen(false)}>
            ✕
          </button>
        </div>
        <p className="m-0 mb-4 text-[#6b7280] text-[0.9rem] leading-normal mt-4">Danh sách các mã giảm giá bạn có thể sử dụng ngay.</p>

        <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
          {(() => {
            const now = new Date();
            const activeVouchers = vouchers.filter(
              v => !v.endDate || new Date(v.endDate) >= now
            );

            if (activeVouchers.length === 0) {
              return <p className="text-center py-6 text-[#6b7280] text-sm">Bạn hiện chưa có mã giảm giá nào.</p>;
            }

            return activeVouchers.map(v => (
              <div key={v.id} className="border border-dashed border-[#818cf8] rounded-xl p-4 bg-profile-primary-lighter flex justify-between items-center">
                <div>
                  <h4 className="m-0 mb-1 text-profile-primary font-bold">{v.code}</h4>
                  <p className="m-0 text-[0.85rem] text-[#6b7280]">
                    Giảm {v.type === "percent" ? `${v.value}%` : `${Number(v.value).toLocaleString("vi-VN")}đ`} 
                    {Number(v.minOrderValue) > 0 && ` cho đơn từ ${Number(v.minOrderValue).toLocaleString("vi-VN")}đ`}
                    {Number(v.maxDiscountValue) > 0 && ` (Tối đa ${Number(v.maxDiscountValue).toLocaleString("vi-VN")}đ)`}
                  </p>
                  {v.endDate && (
                    <p className="mt-1 text-[0.8rem] text-accent-amber font-semibold">
                      HSD: {new Date(v.endDate).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>
                <button 
                  type="button" 
                  className="px-3 py-1.5 font-bold rounded-lg text-[0.85rem] transition-all cursor-pointer bg-profile-primary text-white hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)]"
                  onClick={() => {
                    navigator.clipboard.writeText(v.code);
                    success(`Đã copy mã ${v.code}`);
                  }}
                >
                  Copy mã
                </button>
              </div>
            ));
          })()}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={() => setIsVoucherModalOpen(false)}
            className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-[#f3f4f6] text-[#1f2937] border border-[#e5e7eb] hover:bg-[#e5e7eb] w-full"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoucherWalletModal;
