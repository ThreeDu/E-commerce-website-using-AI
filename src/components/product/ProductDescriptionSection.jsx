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
    <section className="shopx-panel shopx-description-panel">
      <div className="shopx-section-divider">
        <h3>Mô tả chi tiết</h3>
        <p>
          Xem đầy đủ thông tin sản phẩm trong không gian đọc riêng, tách biệt khỏi phần mua hàng để bố cục luôn cân đối.
        </p>
      </div>

      <div className={`shopx-description-card ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
        <div className="shopx-description-card__content">
          {normalizedDescription.split(/\n+/).filter(Boolean).map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
          ))}
        </div>

        {shouldClamp ? <div className="shopx-description-card__fade" aria-hidden="true" /> : null}
      </div>

      {shouldClamp ? (
        <button
          type="button"
          className="shopx-description-toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? "Thu gọn" : "Xem thêm"}
        </button>
      ) : null}
    </section>
  );
}

export default ProductDescriptionSection;