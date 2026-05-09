import { apiClient } from "./apiClient";

/**
 * Upload or update user avatar (base64 encoded image).
 * @param {string} avatar - Base64 encoded image data
 * @param {string} token - Authentication token
 */
export async function uploadAvatar(avatar, token) {
  return apiClient("/api/auth/profile/avatar", {
    method: "PUT",
    body: { avatar },
    token,
  });
}
