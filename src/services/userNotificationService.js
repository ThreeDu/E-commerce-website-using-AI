import { apiClient } from "./apiClient";

export async function fetchNotifications(token, page = 1, limit = 20) {
  return apiClient(`/api/auth/notifications?page=${page}&limit=${limit}`, { token });
}

export async function fetchUnreadCount(token) {
  return apiClient("/api/auth/notifications/unread-count", { token });
}

export async function markAsRead(notificationId, token) {
  return apiClient(`/api/auth/notifications/${notificationId}/read`, {
    method: "PUT",
    token,
  });
}

export async function markAllAsRead(token) {
  return apiClient("/api/auth/notifications/read-all", {
    method: "PUT",
    token,
  });
}

export async function deleteNotification(notificationId, token) {
  return apiClient(`/api/auth/notifications/${notificationId}`, {
    method: "DELETE",
    token,
  });
}
