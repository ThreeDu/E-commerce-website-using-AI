/**
 * User-facing product API service.
 */
import { apiClient } from "./apiClient";

export async function fetchProducts() {
  return apiClient("/api/products");
}

export async function fetchProductById(id) {
  return apiClient(`/api/products/${id}`);
}

export async function trackProductView(id, token) {
  return apiClient(`/api/products/${id}/view`, {
    method: "POST",
    token,
  });
}

export async function fetchReviewEligibility(id, token) {
  return apiClient(`/api/products/${id}/review-eligibility`, { token });
}

export async function createReview(productId, payload, token) {
  return apiClient(`/api/products/${productId}/reviews`, {
    method: "POST",
    body: payload,
    token,
  });
}

export async function updateReview(productId, reviewId, payload, token) {
  return apiClient(`/api/products/${productId}/reviews/${reviewId}`, {
    method: "PUT",
    body: payload,
    token,
  });
}

export async function deleteReview(productId, reviewId, token) {
  return apiClient(`/api/products/${productId}/reviews/${reviewId}`, {
    method: "DELETE",
    token,
  });
}
