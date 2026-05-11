/**
 * Recommendation API service — fetches personalized product suggestions.
 */
import { apiClient } from "./apiClient";
import { getAnonymousId } from "./analyticsService";

/**
 * Fetch recommended products.
 *
 * @param {{ token?: string, limit?: number, cartProductIds?: string[] }} options
 * @returns {Promise<{ products: Array, strategy: string, count: number }>}
 */
export async function fetchRecommendations({ token, limit = 8, cartProductIds = [] } = {}) {
  const anonymousId = getAnonymousId();
  const params = new URLSearchParams();

  if (anonymousId) {
    params.set("anonymousId", anonymousId);
  }

  if (limit) {
    params.set("limit", String(limit));
  }

  // Send current cart product IDs for cart-based recommendations
  if (Array.isArray(cartProductIds) && cartProductIds.length > 0) {
    params.set("cartProductIds", cartProductIds.join(","));
  }

  const url = `/api/analytics/recommendations?${params.toString()}`;
  return apiClient(url, { token });
}
