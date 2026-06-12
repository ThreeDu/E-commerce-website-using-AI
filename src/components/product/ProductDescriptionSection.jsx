import { useMemo, useState } from "react";

function ProductDescriptionSection({ description }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedDescription = useMemo(() => String(description || "").trim(), [description]);
  const hasContent = normalizedDescription.length > 0;
  const shouldClamp = normalizedDescription.length > 520 || normalizedDescription.split(/\n+/).filter(Boolean).length > 4;

  if (!hasContent) {
    return null;
  }

  return (
    <section className="bg-gradient-to-b from-white to-shop-bg border border-shop-line rounded-shop-lg shadow-shop p-[22px] mb-4">
      <div className="pb-3.5 mb-3.5 border-b border-shop-line">
        <h3 className="m-0 mb-1.5 text-lg font-extrabold text-shop-ink">Mô tả chi tiết</h3>
        <p className="m-0 text-shop-muted text-sm leading-[1.55]">
          Xem đầy đủ thông tin sản phẩm trong không gian đọc riêng, tách biệt khỏi phần mua hàng để bố cục luôn cân đối.
        </p>
      </div>

      <div className={`relative border border-shop-line rounded-xl bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] overflow-hidden ${isExpanded ? "" : "max-h-[400px]"}`}>
        <div className="px-4.5 pt-4.5 pb-6 text-[#334155] leading-[1.75] whitespace-pre-line">
          {normalizedDescription.split(/\n+/).filter(Boolean).map((paragraph, index) => (
            <p className="m-0 mb-3 last:mb-0" key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
          ))}
        </div>

        {shouldClamp && !isExpanded ? <div className="absolute left-0 right-0 bottom-0 h-[110px] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.88)_42%,#ffffff_100%)] pointer-events-none" aria-hidden="true" /> : null}
      </div>

      {shouldClamp ? (
        <button
          type="button"
          className="mt-3.5 border border-[rgba(99,102,241,0.18)] bg-white text-[#4338ca] rounded-[14px] px-3.5 py-2.5 text-[13px] font-extrabold cursor-pointer transition-all duration-200 hover:bg-[#eef2ff] hover:border-[rgba(99,102,241,0.28)] hover:-translate-y-px"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      ) : null}
    </section>
  );
}

export default ProductDescriptionSection;