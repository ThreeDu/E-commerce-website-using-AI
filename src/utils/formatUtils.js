/**
 * Shared display formatters (currency, date-time).
 */
import { formatPrice } from "./priceUtils";

/** @example formatCurrency(1500000) → "1.500.000 đ" */
export function formatCurrency(value) {
  return formatPrice(value);
}

/** Localised date-time string, or "-" when there is no value. */
export function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("vi-VN");
}
