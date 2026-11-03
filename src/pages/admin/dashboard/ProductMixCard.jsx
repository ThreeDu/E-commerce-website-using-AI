import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxesStacked } from "@fortawesome/free-solid-svg-icons";

function formatCompactCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function ProductMixCard({ pieBackground, pieSlices, totalSoldUnits }) {
  return (
    <article className="admin-card p-5 sm:p-6 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between pb-3 border-b border-admin-line">
        <div>
          <h2 className="text-base font-bold text-admin-ink m-0 flex items-center gap-2">
            <FontAwesomeIcon icon={faBoxesStacked} className="text-indigo-600" />
            Sản phẩm bán ra
          </h2>
          <span className="text-xs text-admin-muted mt-0.5">
            Tỷ trọng doanh số theo mặt hàng
          </span>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          {totalSoldUnits.toLocaleString("vi-VN")} sp
        </span>
      </div>

      {/* Donut Chart Visual */}
      <div className="flex items-center justify-center py-2">
        <div
          className="w-36 h-36 rounded-full relative shadow-xs flex items-center justify-center transition-all"
          style={{ background: pieBackground }}
        >
          {/* Center Hole */}
          <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
            <span className="text-base font-black text-admin-ink leading-none">
              {totalSoldUnits.toLocaleString("vi-VN")}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-admin-muted mt-1">
              Đã bán
            </span>
          </div>
        </div>
      </div>

      {/* Product breakdown list with progress bars */}
      <div className="flex-1 overflow-y-auto max-h-[220px] flex flex-col gap-2.5 pr-1 scrollbar-thin">
        {pieSlices.length > 0 ? (
          pieSlices.map((slice) => (
            <div
              key={slice.key || slice.label}
              className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <div className="flex items-center gap-2 truncate max-w-[170px]" title={slice.label}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: slice.color }} />
                  <span className="truncate text-slate-800">{slice.label}</span>
                </div>
                <span className="text-slate-600 font-bold shrink-0">{formatPercent(slice.percent)}</span>
              </div>

              {/* Progress line */}
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${slice.percent}%`, background: slice.color }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-admin-muted">
                <span>{Number(slice.soldQuantity || 0).toLocaleString("vi-VN")} sản phẩm</span>
                <span className="font-medium text-slate-700">{formatCompactCurrency(slice.revenue)} đ</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-xs text-admin-muted">
            Chưa có dữ liệu sản phẩm trong kỳ đã chọn.
          </div>
        )}
      </div>
    </article>
  );
}

export default ProductMixCard;
