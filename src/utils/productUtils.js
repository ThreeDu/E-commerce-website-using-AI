/**
 * Shared product utility functions.
 *
 * Centralises helpers that were previously duplicated across
 * HomePage, ProductsPage, ProductDetailPage, CartPage, Header
 * and OrderDetailPage.
 */

/**
 * Resolve a safe image `src` for a product object.
 * Falls back to "/placeholder.svg" when no usable value is found.
 */
export function getProductImageSrc(product) {
  const rawValue = String(product?.image || product?.imageUrl || "").trim();
  if (!rawValue) {
    return "/placeholder.svg";
  }

  if (
    rawValue.startsWith("http://") ||
    rawValue.startsWith("https://") ||
    rawValue.startsWith("data:image/") ||
    rawValue.startsWith("/")
  ) {
    return rawValue;
  }

  return `/${rawValue.replace(/^\/+/, "")}`;
}

/**
 * Derive display-ready pricing info from a product object.
 *
 * @returns {{ basePrice: number, finalPrice: number, hasDiscount: boolean, discountPercent: number }}
 */
export function getProductPricing(product) {
  const basePrice = Math.max(0, Number(product?.price || 0));
  const rawDiscountPercent = Math.max(0, Math.min(100, Number(product?.discountPercent || 0)));
  const finalPriceFromApi = Math.max(0, Number(product?.finalPrice || 0));

  const fallbackFinalPrice = Math.round(basePrice * (1 - rawDiscountPercent / 100));
  const finalPrice =
    finalPriceFromApi > 0 && finalPriceFromApi < basePrice ? finalPriceFromApi : fallbackFinalPrice;

  const hasDiscount = basePrice > 0 && finalPrice < basePrice;
  const discountPercent = hasDiscount
    ? Math.max(1, Math.round(((basePrice - finalPrice) / basePrice) * 100))
    : 0;

  return {
    basePrice,
    finalPrice: hasDiscount ? finalPrice : basePrice,
    hasDiscount,
    discountPercent,
  };
}

/**
 * Check whether a product is out of stock.
 */
export function isOutOfStock(product) {
  return Number(product?.stock || 0) <= 0;
}
