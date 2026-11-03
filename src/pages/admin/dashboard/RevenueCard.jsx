import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowTrendUp } from "@fortawesome/free-solid-svg-icons";
import { formatCurrency } from "../../../utils/formatUtils";

function getMonthLabel(monthNumber) {
  return `Tháng ${monthNumber}`;
}

function RevenueCard({ currentDate, periodType, revenue, selectedMonth, selectedYear, setPeriodType, setSelectedMonth, setSelectedYear, yearOptions }) {
  return (
    <article className="admin-card p-5 sm:p-6 flex flex-col gap-5 h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-admin-line">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-admin-ink m-0 flex items-center gap-2">
            <FontAwesomeIcon icon={faArrowTrendUp} className="text-admin-primary" />
            Tổng quan Doanh thu
          </h2>
          <p className="text-xs text-admin-muted m-0 mt-0.5">
            Thống kê doanh thu theo chu kỳ thanh toán và đơn hoàn tất
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Period segmented buttons */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPeriodType("month")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer border-none ${
                periodType === "month"
                  ? "bg-white text-admin-ink shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800 bg-transparent"
              }`}
            >
              Tháng
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("year")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer border-none ${
                periodType === "year"
                  ? "bg-white text-admin-ink shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800 bg-transparent"
              }`}
            >
              Năm
            </button>
          </div>

          {/* Year select */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-2.5 py-1.5 rounded-xl border border-admin-line bg-white text-xs font-semibold text-admin-ink focus:outline-none focus:border-admin-primary"
            aria-label="Chọn năm"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                Năm {year}
              </option>
            ))}
          </select>

          {/* Month select (if month view) */}
          {periodType === "month" && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-xl border border-admin-line bg-white text-xs font-semibold text-admin-ink focus:outline-none focus:border-admin-primary"
              aria-label="Chọn tháng"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {getMonthLabel(m)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Financial KPI Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between">
          <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
            Doanh thu kỳ đã chọn
          </span>
          <div className="text-xl sm:text-2xl font-black text-admin-ink tracking-tight mt-1.5">
            {formatCurrency(revenue?.totals?.selectedPeriodRevenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {periodType === "month" ? `${getMonthLabel(selectedMonth)}/${selectedYear}` : `Cả năm ${selectedYear}`}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between">
          <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
            Đơn đã hoàn tất kỳ này
          </span>
          <div className="text-xl sm:text-2xl font-black text-admin-ink tracking-tight mt-1.5">
            {Number(revenue?.totals?.selectedPeriodOrders || 0).toLocaleString("vi-VN")} đơn
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Đã thanh toán và giao thành công
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between">
          <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
            Doanh thu tháng này
          </span>
          <div className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight mt-1">
            {formatCurrency(revenue?.totals?.thisMonth)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tháng {currentDate.getMonth() + 1}/{currentDate.getFullYear()}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/60 flex flex-col justify-between">
          <span className="text-xs font-bold text-admin-muted uppercase tracking-wider">
            Doanh thu năm nay
          </span>
          <div className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight mt-1">
            {formatCurrency(revenue?.totals?.thisYear)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Năm {currentDate.getFullYear()}
          </div>
        </div>
      </div>
    </article>
  );
}

export default RevenueCard;
