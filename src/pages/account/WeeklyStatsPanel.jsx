import { formatPrice, parsePrice } from "../../utils/priceUtils";

function WeeklyStatsPanel({ weeklyStats, weeklyStatsLoading }) {
  return (
    <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col gap-6 text-left">
      <div>
        <span className="text-[11px] font-bold text-[#6366f1] uppercase tracking-wider block mb-1">Thống kê hoạt động</span>
        <h2 className="text-2xl font-black text-[#1e293b] m-0 mb-1 leading-tight">Hoạt động tuần này</h2>
        <p className="text-xs text-[#94a3b8] m-0 leading-normal mt-0.5">Theo dõi lịch sử truy cập và chi tiêu cá nhân trong tuần</p>
      </div>

      {weeklyStatsLoading ? (
        <div className="py-20 text-center text-slate-500 font-medium space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Đang tải báo cáo của bạn...</p>
        </div>
      ) : weeklyStats ? (
        <div className="space-y-6">
          {/* Stats metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#eff6ff] to-[#dbeafe]/40 border border-[#dbeafe]/80 shadow-sm flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#2563eb] uppercase tracking-wide">Truy cập tuần này</span>
              <strong className="text-slate-800 text-2xl font-black">{weeklyStats.weeklyVisits} lượt</strong>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#fef2f2] to-[#fee2e2]/40 border border-[#fee2e2]/80 shadow-sm flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#ef4444] uppercase tracking-wide">Chi tiêu trọn đời</span>
              <strong className="text-red-600 text-2xl font-black">{formatPrice(parsePrice(weeklyStats.totalSpent))}</strong>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7]/40 border border-[#dcfce7]/80 shadow-sm flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#16a34a] uppercase tracking-wide">Đơn hàng đã đặt</span>
              <strong className="text-slate-800 text-2xl font-black">{weeklyStats.totalOrders} đơn</strong>
            </div>
          </div>

          {/* Spending chart by day (Monday to Sunday) */}
          <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-4">
            <div className="font-bold text-slate-800 text-sm">Biểu đồ chi tiêu tuần này</div>
            <div className="h-[200px] flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-200">
              {weeklyStats.weeklySpendsByDay?.map((amount, idx) => {
                const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
                const maxSpend = Math.max(...weeklyStats.weeklySpendsByDay, 1);
                const heightPercent = (amount / maxSpend) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                    {/* Amount Tooltip on hover */}
                    {amount > 0 && (
                      <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-md z-10">
                        {formatPrice(parsePrice(amount))}
                      </div>
                    )}
                    {/* Bar */}
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 cursor-pointer ${
                        amount > 0 ? "bg-gradient-to-t from-indigo-500 to-violet-500 shadow-[0_4px_12px_rgba(99,102,241,0.25)] hover:from-indigo-600 hover:to-violet-600" : "bg-slate-100"
                      }`}
                      style={{ height: `${Math.max(4, heightPercent)}%` }}
                    />
                    {/* Label */}
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                      {dayNames[idx]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Notification Summary */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-[#f8fbff] border-indigo-100 flex gap-3.5 items-start">
            <span className="text-xl text-indigo-600 shrink-0">📊</span>
            <div className="space-y-1">
              <div className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Báo cáo hoạt động tuần</div>
              <p className="text-xs text-[#4f6078] leading-relaxed m-0">
                {weeklyStats.weeklyVisits > 0 || weeklyStats.weeklySpendsByDay?.reduce((a,b)=>a+b, 0) > 0 ? (
                  `Tuần này bạn đã ghé thăm shop ${weeklyStats.weeklyVisits} lần và tích cực mua sắm. Tổng số đơn hàng trọn đời đã đặt đạt ${weeklyStats.totalOrders} đơn với mức chi tiêu ${formatPrice(parsePrice(weeklyStats.totalSpent))}.`
                ) : (
                  "Tuần này bạn chưa có hoạt động truy cập hay mua sắm nào. Hãy tham khảo các sản phẩm mới nhất của chúng tôi!"
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-400 py-10">Không tìm thấy dữ liệu báo cáo tuần này.</p>
      )}
    </article>
  );
}

export default WeeklyStatsPanel;
