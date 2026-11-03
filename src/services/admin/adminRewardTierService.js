import { apiClient } from "../apiClient";

const REWARDS_BASE = "/api/auth/admin/rewards";

export async function getAdminRewardTiers(token) {
  return apiClient(REWARDS_BASE, {
    token,
    errorMessage: "Không thể tải danh sách mức đổi thưởng.",
  });
}

export async function getAdminRewardTierById(token, tierId) {
  return apiClient(`${REWARDS_BASE}/${tierId}`, {
    token,
    errorMessage: "Không thể lấy thông tin chi tiết mức đổi thưởng.",
  });
}

export async function createAdminRewardTier(token, payload) {
  return apiClient(REWARDS_BASE, {
    method: "POST",
    body: payload,
    token,
    errorMessage: "Không thể thêm mức đổi thưởng.",
  });
}

export async function updateAdminRewardTier(token, tierId, payload) {
  return apiClient(`${REWARDS_BASE}/${tierId}`, {
    method: "PUT",
    body: payload,
    token,
    errorMessage: "Không thể cập nhật mức đổi thưởng.",
  });
}

export async function deleteAdminRewardTier(token, tierId) {
  return apiClient(`${REWARDS_BASE}/${tierId}`, {
    method: "DELETE",
    token,
    errorMessage: "Không thể xóa mức đổi thưởng.",
  });
}
