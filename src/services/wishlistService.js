/**
 * User-facing wishlist API service.
 */
import { apiClient } from "./apiClient";

export async function fetchWishlist(token) {
  return apiClient("/api/auth/wishlist", { token });
}

export async function addToWishlist(productId, token) {
  return apiClient("/api/auth/wishlist", {
    method: "POST",
    body: { productId },
    token,
  });
}

export async function removeFromWishlist(productId, token) {
  return apiClient(`/api/auth/wishlist/${productId}`, {
    method: "DELETE",
    token,
  });
}
