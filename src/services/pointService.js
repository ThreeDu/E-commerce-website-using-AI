/**
 * User-facing loyalty points API service.
 */
import { apiClient } from "./apiClient";

export async function getMyPoints(token) {
  return apiClient("/api/points/me", { token });
}

export async function getRewards(token) {
  return apiClient("/api/points/rewards", { token });
}

export async function redeemPoints(rewardTierId, token) {
  return apiClient("/api/points/redeem", {
    method: "POST",
    body: { rewardTierId },
    token,
  });
}
