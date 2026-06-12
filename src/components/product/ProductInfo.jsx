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
    <section className="grid grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)] gap-[18px] p-[22px] mb-3.5 bg-gradient-to-b from-white to-shop-bg border border-shop-line rounded-shop-lg shadow-shop max-[960px]:grid-cols-1 max-[960px]:p-4">
      <div className="relative">
        {pricing.hasDiscount ? <span className="absolute top-2 left-2 z-10 inline-flex items-center justify-center min-h-[24px] px-2.5 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ef4444] text-white border border-[#dc2626]">-{pricing.discountPercent}%</span> : null}
        {outOfStock ? <span className="absolute left-2 right-2 bottom-2 z-10 inline-flex items-center justify-center min-h-[24px] px-2 py-0.5 rounded-full text-[11px] font-extrabold tracking-wider bg-[#ef4444] text-white border border-[#dc2626]">Hết hàng</span> : null}
        <img
          src={getProductImageSrc(product)}
          alt={product.name}
          className={`w-full h-[520px] object-cover rounded-[20px] border border-[rgba(148,163,184,0.22)] bg-gradient-to-br from-[#eef6ff] to-[#fef6ef] shadow-[0_16px_34px_rgba(15,23,42,0.08)] max-[960px]:h-[360px] ${outOfStock ? "grayscale-[55%] brightness-[88%]" : ""}`}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/placeholder.svg";
          }}
        />
      </div>
      <div className="flex flex-col gap-3.5 p-[4px_2px_4px_0] self-start max-h-[calc(520px+60px)] overflow-y-auto pr-2 scrollbar-thin">
        <h1 className="m-0 font-black text-[clamp(32px,3vw,40px)] leading-[1.08] text-shop-ink max-[720px]:text-[30px]">{product.name}</h1>
        <p className="m-0 text-shop-muted text-sm leading-[1.5]">
          Danh mục: <strong className="font-bold text-shop-ink">{product.category}</strong>
        </p>

        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#fff5d9] text-[#92400e]">
            {Number(product.averageRating || 0).toFixed(1)} sao ({Number(product.totalRatings || 0)} đánh giá)
          </span>
          <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#e6f7ff] text-[#075985]">{Number(product.totalViews || 0)} lượt xem</span>
          <span className="inline-flex items-center rounded-full border border-shop-line px-2.5 py-1 text-xs font-bold bg-[#ebfbe8] text-[#166534]">{Number(product.totalPurchases || 0)} lượt mua</span>
        </div>

        <p className="my-3 text-[#be2f00] text-[21px] font-extrabold">{pricing.finalPrice.toLocaleString("vi-VN")} đ</p>
        {pricing.hasDiscount ? (
          <p className="-mt-1.5 mb-2.5 text-[#94a3b8] text-sm line-through font-bold">{pricing.basePrice.toLocaleString("vi-VN")} đ</p>
        ) : null}

        <div className="border border-[rgba(148,163,184,0.18)] rounded-[18px] bg-shop-bg p-[14px_16px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] max-h-[360px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-2.5 text-xs text-shop-muted font-bold uppercase tracking-wider">
            <span>Tóm tắt nổi bật</span>
            <span>{summaryBullets.length} điểm</span>
          </div>
          <ul className="m-0 pl-[18px] grid gap-2 text-[#334155] leading-[1.55] max-h-[280px] overflow-y-auto pr-2 scrollbar-thin marker-primary">
            {summaryBullets.length > 0 ? (
              summaryBullets.map((bullet, index) => (
                <li key={`${bullet}-${index}`}>{bullet}</li>
              ))
            ) : (
              <li>Thông tin chi tiết về sản phẩm sẽ hiển thị ở phần mô tả bên dưới.</li>
            )}
          </ul>
        </div>

        <div className="flex flex-wrap gap-2.5 mt-auto pt-2">
          <button
            type="button"
            disabled={isWishlistLoading}
            onClick={onToggleWishlist}
            className={isWishlisted
              ? "rounded-[14px] border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs disabled:cursor-not-allowed disabled:opacity-70"
              : "rounded-[14px] border border-[#fdba74] bg-[#fff7ed] text-[#c2410c] px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:bg-[#ffedd5] disabled:cursor-not-allowed disabled:opacity-70"
            }
          >
            {isWishlistLoading ? "Đang xử lý..." : isWishlisted ? "Đã yêu thích" : "Thêm yêu thích"}
          </button>
          <button
            type="button"
            onClick={onAddToCart}
            className={outOfStock
              ? "rounded-[14px] border border-[#fca5a5] bg-[#fee2e2] text-[#b91c1c] px-3 py-2.5 text-sm font-bold cursor-not-allowed opacity-100"
              : "rounded-[14px] border border-[#0f766e] bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white px-3 py-2.5 text-sm font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-xs hover:from-[#159287] hover:to-[#0f766e] disabled:cursor-not-allowed disabled:opacity-70"
            }
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
