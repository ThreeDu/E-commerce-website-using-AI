import { formatPrice } from "../../../utils/priceUtils";

function CustomerTable({ currentCustomers, segmentNames }) {
  return (
    <table className="w-full min-w-[720px] text-left border-collapse table-auto text-sm">
      <thead>
        <tr className="[&>th]:p-3 [&>th]:border-b-2 [&>th]:border-[#e2e8f0] [&>th]:text-xs [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wider [&>th]:text-[#475569] [&>th]:whitespace-nowrap">
          <th>Khách hàng</th>
          <th>Phân khúc</th>
          <th>Churn Risk</th>
          <th>Potential</th>
          <th>CLV Score</th>
          <th>Chi tiêu dự đoán</th>
          <th>Đơn hàng</th>
          <th>Chi tiêu</th>
          <th>Views (30d)</th>
          <th>Wishlist</th>
          <th>Không HĐ (ngày)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {currentCustomers.map((c) => (
          <tr key={c._id} className="hover:bg-[#f8fafc] [&>td]:p-3 [&>td]:text-[#334155] [&>td]:align-middle">
            <td>
              <strong className="text-admin-ink">{c.name}</strong>
              <br />
              <span className="text-xs text-admin-muted">{c.email}</span>
            </td>
            <td>
              {c.segment && segmentNames[c.segment] ? (
                <span
                  className="inline-block px-2 py-1 text-xs font-medium rounded-md border"
                  style={{
                    borderColor: segmentNames[c.segment].color,
                    color: segmentNames[c.segment].color,
                    backgroundColor: `${segmentNames[c.segment].color}10`
                  }}
                >
                  {segmentNames[c.segment].label}
                </span>
              ) : (
                <span className="text-admin-muted">—</span>
              )}
            </td>
            <td>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                c.churn_level === "low" ? "bg-green-100 text-green-800" : c.churn_level === "medium" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
              }`}>
                {c.churn_score}%
              </span>
            </td>
            <td>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                c.potential_level === "low" ? "bg-slate-100 text-slate-600" : c.potential_level === "medium" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
              }`}>
                {c.potential_score}
              </span>
            </td>
            <td>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                c.clv_level === "high" ? "bg-purple-100 text-purple-800" : c.clv_level === "medium" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
              }`}>
                {c.clv_score || 0}
              </span>
            </td>
            <td>{formatPrice(c.predicted_spend || 0)}</td>
            <td>{c.frequency}</td>
            <td>{formatPrice(c.monetary || 0)}</td>
            <td>{c.product_views_30d}</td>
            <td>{c.wishlist_size}</td>
            <td>{c.recency_days > 900 ? "—" : c.recency_days}</td>
          </tr>
        ))}
        {currentCustomers.length === 0 ? (
          <tr>
            <td colSpan={11} className="text-center! p-8! text-admin-muted font-medium">
              Không tìm thấy khách hàng phù hợp.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export default CustomerTable;
