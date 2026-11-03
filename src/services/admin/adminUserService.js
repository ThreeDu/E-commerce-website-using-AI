import { apiClient } from "../apiClient";

export async function getAdminUsers(token) {
  return apiClient("/api/auth/admin/users", {
    token,
    errorMessage: "Không thể lấy danh sách người dùng",
  });
}

export async function updateAdminUser(token, userId, payload) {
  return apiClient(`/api/auth/admin/users/${userId}`, {
    method: "PUT",
    body: payload,
    token,
    errorMessage: "Không thể cập nhật người dùng",
  });
}

export async function deleteAdminUser(token, userId) {
  return apiClient(`/api/auth/admin/users/${userId}`, {
    method: "DELETE",
    token,
    errorMessage: "Không thể xóa người dùng",
  });
}

export async function updateAdminUserPoints(token, userId, points, reason) {
  return apiClient(`/api/auth/admin/users/${userId}/points`, {
    method: "PUT",
    body: { points, reason },
    token,
    errorMessage: "Không thể cập nhật điểm tích lũy",
  });
}

export async function updateAdminUserPassword(token, userId, password) {
  return apiClient(`/api/auth/admin/users/${userId}/password`, {
    method: "PUT",
    body: { password },
    token,
    errorMessage: "Không thể cập nhật mật khẩu",
  });
}

export async function getAdminUserStats(token, userId) {
  return apiClient(`/api/auth/admin/users/${userId}/stats`, {
    token,
    errorMessage: "Không thể lấy thông tin khách hàng",
  });
}

export async function createAdminQuickVoucher(token, userId, payload) {
  return apiClient(`/api/auth/admin/users/${userId}/quick-voucher`, {
    method: "POST",
    body: payload,
    token,
    errorMessage: "Lỗi tạo voucher",
  });
}
