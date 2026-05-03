/**
 * Shared price parsing / formatting helpers.
 *
 * Previously duplicated in CartPage and CheckoutPage.
 */

/**
 * Parse a raw price value (string or number) into a numeric value.
 * Strips all non-digit characters when given a formatted string.
 */
export function parsePrice(price) {
  if (typeof price === "number") return price;
  if (typeof price === "string") {
    return parseInt(price.replace(/\D/g, ""), 10) || 0;
  }
  return 0;
}

/**
 * Format a numeric price for display in VND.
 *
 * @example formatPrice(1500000) → "1.500.000 đ"
 */
export function formatPrice(priceNum) {
  return priceNum.toLocaleString("vi-VN") + " đ";
}
