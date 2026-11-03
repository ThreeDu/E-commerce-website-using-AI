import { apiClient } from "../apiClient";

export async function getAdminNotifications(token) {
  return apiClient("/api/auth/admin/notifications", {
    token,
    errorMessage: "Không thể tải thông báo admin",
  });
}
