/**
 * User cart API service (server-side copy of the cart for logged-in users).
 */
import { apiClient } from "./apiClient";

export async function fetchCart(token) {
  return apiClient("/api/auth/cart", {
    token,
    errorMessage: "Không thể lấy giỏ hàng từ server",
  });
}

export async function syncCart(items, token) {
  return apiClient("/api/auth/cart/sync", {
    method: "POST",
    body: { items },
    token,
  });
}
