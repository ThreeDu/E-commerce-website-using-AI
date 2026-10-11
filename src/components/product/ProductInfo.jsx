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
    <section className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs grid grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)] gap-8 max-[960px]:grid-cols-1">
      {/* Product Image */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-50 flex items-center justify-center p-4 aspect-square max-h-[480px]">
        {pricing.hasDiscount ? (
          <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-black tracking-wide shadow-xs">
            -{pricing.discountPercent}%
          </span>
        ) : null}

        {outOfStock ? (
          <span className="absolute left-3 right-3 bottom-3 z-10 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-sm text-white text-xs font-bold text-center">
            Tạm hết hàng
          </span>
        ) : null}

        <img
          src={getProductImageSrc(product)}
          alt={product.name}
          className={`max-w-full max-h-full object-contain p-2 transition-transform duration-300 ${
            outOfStock ? "grayscale-[40%] opacity-70" : ""
          }`}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = "/placeholder.svg";
          }}
        />
      </div>

      {/* Product Info & Actions */}
      <div className="flex flex-col gap-4 self-start">
        <div>
          <div className="text-xs font-bold text-teal-700 uppercase tracking-wider mb-1.5">
            {product.category}
          </div>
          <h1 className="m-0 font-black text-2xl sm:text-3xl text-slate-900 leading-tight">
            {product.name}
          </h1>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-amber-50/60 px-3 py-1 text-xs font-bold text-amber-800">
              ★ {Number(product.averageRating || 0).toFixed(1)} ({Number(product.totalRatings || 0)} đánh giá)
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {Number(product.totalViews || 0)} lượt xem
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {Number(product.totalPurchases || 0)} đã bán
            </span>
          </div>
        </div>

        {/* Pricing */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
          <div className="text-2xl sm:text-3xl font-black text-slate-900">
            {pricing.finalPrice.toLocaleString("vi-VN")} đ
          </div>
          {pricing.hasDiscount ? (
            <div className="mt-1 text-xs text-slate-400 line-through font-semibold">
              Giá niêm yết: {pricing.basePrice.toLocaleString("vi-VN")} đ
            </div>
          ) : null}
        </div>

        {/* Highlight Summary */}
        <div className="border border-slate-200/80 rounded-2xl bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-2.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>✨ Tóm tắt nổi bật</span>
            <span>{summaryBullets.length} điểm chính</span>
          </div>
          <ul className="m-0 pl-4 grid gap-1.5 text-xs text-slate-700 leading-relaxed list-disc">
            {summaryBullets.length > 0 ? (
              summaryBullets.map((bullet, index) => (
                <li key={`${bullet}-${index}`}>{bullet}</li>
              ))
            ) : (
              <li>Thông tin chi tiết về thông số kỹ thuật được cập nhật ở tab bên dưới.</li>
            )}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isWishlistLoading}
            onClick={onToggleWishlist}
            className={`py-3 px-5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
              isWishlisted
                ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
            }`}
          >
            {isWishlistLoading ? "Đang xử lý..." : isWishlisted ? "❤️ Đã yêu thích" : "🤍 Thêm yêu thích"}
          </button>

          <button
            type="button"
            onClick={onAddToCart}
            disabled={outOfStock}
            className={`flex-1 min-w-[160px] py-3 px-6 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
              outOfStock
                ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-teal-700 hover:bg-teal-800 border-teal-700 text-white shadow-xs active:scale-[0.98]"
            }`}
          >
            {outOfStock ? "Tạm hết hàng" : "🛒 Thêm vào giỏ hàng"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default ProductInfo;
