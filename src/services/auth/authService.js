import { apiClient } from "../apiClient";

export async function registerUser(payload) {
  return apiClient("/api/auth/register", {
    method: "POST",
    body: payload,
    errorMessage: "Register failed",
  });
}

export async function loginUser(payload) {
  return apiClient("/api/auth/login", {
    method: "POST",
    body: payload,
    errorMessage: "Login failed",
  });
}

export async function verifyAdminToken(token) {
  return apiClient("/api/auth/verify-admin", {
    token,
    errorMessage: "Xác thực admin thất bại",
  });
}

export async function changePassword(payload, token) {
  return apiClient("/api/auth/change-password", {
    method: "PUT",
    body: payload,
    token,
    errorMessage: "Không thể đổi mật khẩu.",
  });
}

export async function updateProfile(payload, token) {
  return apiClient("/api/auth/profile", {
    method: "PUT",
    body: payload,
    token,
    errorMessage: "Không thể cập nhật thông tin cá nhân.",
  });
}
