/**
 * Product information section: image, name, category, meta, pricing,
 * wishlist toggle, add-to-cart, and description.
 *
 * Extracted from ProductDetailPage to follow Single Responsibility Principle.
 */
import { getProductImageSrc, getProductPricing, isOutOfStock } from "../../utils/productUtils";

function buildSummaryBullets(description) {
  const raw = String(description || "").replace(/\r/g, "\n").trim();
  if (!raw) return [];

  const lines = raw
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  const candidates = lines.length > 1
    ? lines
    : raw
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean);

  return candidates.slice(0, 4);
}

function ProductInfo({
  product,
  isWishlisted,
  isWishlistLoading,
  onToggleWishlist,
  onAddToCart,
}) {
  const pricing = getProductPricing(product);
  const outOfStock = isOutOfStock(product);
  const summaryBullets = buildSummaryBullets(product.description);

  return (
    <section className="shopx-panel shopx-detail">
      <div className={`shopx-detail-media ${outOfStock ? "is-out-of-stock" : ""}`}>
        {pricing.hasDiscount ? <span className="shopx-sale-badge">-{pricing.discountPercent}%</span> : null}
        {outOfStock ? <span className="shopx-stock-badge">Hết hàng</span> : null}
        <img
          src={getProductImageSrc(product)}
          alt={product.name}
          className="shopx-detail-image"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/placeholder.svg";
          }}
        />
      </div>
      <div className="shopx-detail-content">
        <h1 className="shopx-detail-name">{product.name}</h1>
        <p className="shopx-detail-kicker">
          Danh mục: <strong>{product.category}</strong>
        </p>

        <div className="shopx-meta-row">
          <span className="shopx-chip shopx-chip--rating">
            {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)} đánh giá)
          </span>
          <span className="shopx-chip shopx-chip--views">{Number(product.totalViews || 0)} lượt xem</span>
          <span className="shopx-chip shopx-chip--sold">{Number(product.totalPurchases || 0)} lượt mua</span>
        </div>

        <p className="shopx-price">{pricing.finalPrice.toLocaleString("vi-VN")} đ</p>
        {pricing.hasDiscount ? (
          <p className="shopx-old-price">{pricing.basePrice.toLocaleString("vi-VN")} đ</p>
        ) : null}

        <div className="shopx-detail-summary">
          <div className="shopx-detail-summary__head">
            <span>Tóm tắt nổi bật</span>
            <span>{summaryBullets.length} điểm</span>
          </div>
          <ul className="shopx-detail-summary__list">
            {summaryBullets.length > 0 ? (
              summaryBullets.map((bullet, index) => (
                <li key={`${bullet}-${index}`}>{bullet}</li>
              ))
            ) : (
              <li>Thông tin chi tiết về sản phẩm sẽ hiển thị ở phần mô tả bên dưới.</li>
            )}
          </ul>
        </div>

        <div className="shopx-detail-actions">
          <button
            type="button"
            disabled={isWishlistLoading}
            onClick={onToggleWishlist}
            className={`shopx-btn shopx-btn--ghost shopx-btn--wishlist ${isWishlisted ? "shopx-btn--active" : ""}`}
          >
            {isWishlistLoading ? "Đang xử lý..." : isWishlisted ? "Đã yêu thích" : "Thêm yêu thích"}
          </button>
          <button
            type="button"
            onClick={onAddToCart}
            className={`shopx-btn shopx-btn--primary shopx-btn--cart ${outOfStock ? "shopx-btn--out-of-stock" : ""}`}
            disabled={outOfStock}
          >
            {outOfStock ? "Hết hàng" : "Thêm vào giỏ hàng"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default ProductInfo;
