/**
 * Product information section: image, name, category, meta, pricing,
 * wishlist toggle, add-to-cart, and description.
 *
 * Extracted from ProductDetailPage to follow Single Responsibility Principle.
 */
import { getProductImageSrc, getProductPricing, isOutOfStock } from "../../utils/productUtils";

function ProductInfo({
  product,
  isWishlisted,
  isWishlistLoading,
  onToggleWishlist,
  onAddToCart,
}) {
  const pricing = getProductPricing(product);
  const outOfStock = isOutOfStock(product);

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
      <div>
        <h1 className="shopx-detail-name">{product.name}</h1>
        <p className="shopx-subtitle" style={{ marginTop: "12px" }}>
          Danh mục: <strong>{product.category}</strong>
        </p>

        <div className="shopx-meta-row" style={{ marginTop: "12px" }}>
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

        <p className="shopx-detail-desc">{product.description}</p>
      </div>
    </section>
  );
}

export default ProductInfo;
