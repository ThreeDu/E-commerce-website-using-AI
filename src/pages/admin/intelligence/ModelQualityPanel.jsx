import { formatPrice } from "../../../utils/priceUtils";

const pct = (value) => (value == null ? "—" : `${(value * 100).toFixed(1)}%`);
const num = (value) => (value == null ? "—" : value.toFixed(3));

const CLASSIFIERS = [
  {
    key: "churn",
    title: "Rời bỏ (Churn)",
    color: "#ef4444",
    describe: (days) => `Khách đã từng mua nhưng không có đơn hoàn tất nào trong ${days} ngày sau mốc dự đoán.`,
  },
  {
    key: "potential",
    title: "Tiềm năng mua",
    color: "#8b5cf6",
    describe: (days) => `Khách phát sinh ít nhất một đơn hoàn tất trong ${days} ngày tới.`,
  },
];

function Metric({ label, value, hint }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">{label}</span>
      <strong className="text-lg text-[#0f172a]">{value}</strong>
      {hint ? <span className="text-[11px] text-admin-muted">{hint}</span> : null}
    </div>
  );
}

function TrainingInfo({ metrics }) {
  return (
    <p className="m-0 text-[11px] text-admin-muted">
      {metrics.samples} mẫu · {metrics.customers} khách · {metrics.snapshots} mốc snapshot · kiểm định chéo {metrics.cv_folds} fold theo khách
    </p>
  );
}

/**
 * Chất lượng mô hình từ lần huấn luyện gần nhất (đánh giá out-of-fold, so với baseline một đặc trưng).
 */
function ModelQualityPanel({ lastTraining }) {
  const clv = lastTraining?.clv_metrics;
  const hasNewMetrics = CLASSIFIERS.some(({ key }) => lastTraining?.[`${key}_metrics`]?.roc_auc != null);

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs mb-7">
      <h3 className="m-0 mb-1 text-base font-bold text-[#1e293b]">Chất lượng mô hình</h3>
      <p className="m-0 mb-4 text-xs text-admin-muted">
        Nhãn lấy từ hành vi thật sau từng mốc thời gian trong quá khứ; chỉ số đo trên khách hàng mô hình chưa thấy khi huấn luyện.
        Baseline là dự đoán chỉ dựa vào số ngày kể từ lần mua cuối.
      </p>

      {!hasNewMetrics ? (
        <p className="m-0 text-sm text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4">
          Chưa có chỉ số theo phương pháp mới. Nhấn <strong>Train Model</strong> để huấn luyện lại.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {CLASSIFIERS.map(({ key, title, color, describe }) => {
            const m = lastTraining?.[`${key}_metrics`];
            if (!m || m.error) {
              return (
                <div key={key} className="border border-[#e2e8f0] rounded-xl p-4 text-sm text-admin-muted">
                  {title}: {m?.error || "chưa huấn luyện"}
                </div>
              );
            }
            return (
              <div key={key} className="border border-[#e2e8f0] rounded-xl p-4 flex flex-col gap-3" style={{ borderTop: `3px solid ${color}` }}>
                <div>
                  <h4 className="m-0 text-sm font-bold text-[#1e293b]">{title}</h4>
                  <p className="m-0 mt-1 text-xs text-[#475569]">{describe(m.horizon_days)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="ROC-AUC" value={num(m.roc_auc)} hint={`baseline ${num(m.baseline?.roc_auc)}`} />
                  <Metric label="PR-AUC" value={num(m.pr_auc)} hint={`tỉ lệ nền ${pct(m.base_rate)}`} />
                  <Metric label="F1 (ngưỡng 0.5)" value={num(m.f1)} />
                  <Metric label="Brier" value={num(m.brier)} hint="càng thấp càng tốt" />
                </div>
                <TrainingInfo metrics={m} />
              </div>
            );
          })}

          {clv && !clv.error ? (
            <div className="border border-[#e2e8f0] rounded-xl p-4 flex flex-col gap-3" style={{ borderTop: "3px solid #3b82f6" }}>
              <div>
                <h4 className="m-0 text-sm font-bold text-[#1e293b]">Chi tiêu dự đoán (CLV)</h4>
                <p className="m-0 mt-1 text-xs text-[#475569]">
                  Tổng giá trị đơn hoàn tất trong {clv.horizon_days} ngày tới. CLV Score là thứ hạng phần trăm của chi tiêu dự đoán.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Sai số TB (MAE)" value={formatPrice(clv.mae)} hint={`baseline ${formatPrice(clv.baseline?.mae)}`} />
                <Metric label="R²" value={num(clv.r2)} />
                <Metric label="Spearman" value={num(clv.spearman)} hint="độ đúng thứ hạng" />
                <Metric label="Chi tiêu TB thực tế" value={formatPrice(clv.mean_target)} />
              </div>
              <TrainingInfo metrics={clv} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ModelQualityPanel;
