/**
 * Recommendation API service — fetches personalized product suggestions.
 */
import { apiClient } from "./apiClient";
import { getAnonymousId } from "./analyticsService";

/**
 * Fetch recommended products.
 *
 * @param {{ token?: string, limit?: number }} options
 * @returns {Promise<{ products: Array, strategy: string, count: number }>}
 */
export async function fetchRecommendations({ token, limit = 8 } = {}) {
  const anonymousId = getAnonymousId();
  const params = new URLSearchParams();

  if (anonymousId) {
    params.set("anonymousId", anonymousId);
  }

  if (limit) {
    params.set("limit", String(limit));
  }

  const url = `/api/analytics/recommendations?${params.toString()}`;
  return apiClient(url, { token });
}
