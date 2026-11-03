import { getProductImageSrc, getProductPricing, isOutOfStock } from "../../utils/productUtils";
import { Link } from "react-router-dom";

function ProductGrid({ currentProducts, handleAddToCart, handleToggleWishlist, pendingWishlistIds, wishlistIds }) {
  return (
    <div className="grid grid-cols-3 gap-4 max-[960px]:grid-cols-2 max-[640px]:grid-cols-1">
      {currentProducts.map((product) => {
        const productId = String(product._id);
        const isWishlisted = wishlistIds.includes(productId);
        const isPending = pendingWishlistIds.includes(productId);
        const outOfStock = isOutOfStock(product);
        const pricing = getProductPricing(product);

        return (
          <article
            key={productId}
            className="bg-white border border-slate-200/80 rounded-2xl p-3 flex flex-col h-full transition-all duration-200 hover:border-teal-500 hover:shadow-md group"
          >
            <div className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-3 aspect-square flex items-center justify-center">
              {pricing.hasDiscount ? (
                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black tracking-wide shadow-xs">
                  -{pricing.discountPercent}%
                </span>
              ) : null}

              {outOfStock ? (
                <span className="absolute left-2 right-2 bottom-2 z-10 py-1 rounded-md bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold text-center">
                  Tạm hết hàng
                </span>
              ) : null}

              <button
                type="button"
                aria-label={isWishlisted ? "Bỏ yêu thích" : "Thêm yêu thích"}
                disabled={isPending}
                onClick={() => handleToggleWishlist(productId)}
                className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center border cursor-pointer transition-transform active:scale-90 ${
                  isWishlisted
                    ? "bg-rose-50 border-rose-200 text-rose-600"
                    : "bg-white/90 border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-white"
                }`}
              >
                <span className="text-xs">{isWishlisted ? "❤️" : "🤍"}</span>
              </button>

              <Link to={`/products/${product._id}`} className="w-full h-full flex items-center justify-center">
                <img
                  src={getProductImageSrc(product)}
                  alt={product.name}
                  className={`max-w-full max-h-full object-contain p-2 transition-transform duration-200 group-hover:scale-105 ${
                    outOfStock ? "grayscale-[40%] opacity-70" : ""
                  }`}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = "/placeholder.svg";
                  }}
                />
              </Link>
            </div>

            <Link to={`/products/${product._id}`} className="no-underline flex-1 flex flex-col">
              <h3 className="m-0 text-xs font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-teal-700 transition-colors">
                {product.name}
              </h3>

              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                <span className="text-amber-500 font-bold">★ {Number(product.averageRating || 0).toFixed(1)}</span>
                <span>•</span>
                <span>{Number(product.totalPurchases || 0)} đã mua</span>
              </div>

              <div className="mt-2.5">
                <div className="text-sm font-extrabold text-slate-900">
                  {pricing.finalPrice.toLocaleString("vi-VN")} đ
                </div>
                {pricing.hasDiscount ? (
                  <div className="text-[11px] text-slate-400 line-through">
                    {pricing.basePrice.toLocaleString("vi-VN")} đ
                  </div>
                ) : null}
              </div>
            </Link>

            <button
              type="button"
              disabled={outOfStock}
              onClick={() => handleAddToCart(product)}
              className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                outOfStock
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-teal-700 hover:bg-teal-800 border-teal-700 text-white shadow-xs active:scale-[0.98]"
              }`}
            >
              {outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
            </button>
          </article>
        );
      })}
    </div>
  );
}

export default ProductGrid;
