import { apiClient, buildQueryString } from "../apiClient";

export async function getAdminSystemLogs(token, params = {}) {
  return apiClient(`/api/auth/admin/system-logs${buildQueryString(params)}`, {
    token,
    errorMessage: "Không thể lấy log hệ thống",
  });
}
