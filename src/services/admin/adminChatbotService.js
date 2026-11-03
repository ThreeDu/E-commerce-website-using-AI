import { apiClient } from "../apiClient";

export async function getAdminChatbotSessions(token) {
  return apiClient("/api/admin/chatbot/sessions", { token });
}

export async function getAdminChatbotSession(token, sessionId) {
  return apiClient(`/api/admin/chatbot/sessions/${sessionId}`, { token });
}

export async function deleteAdminChatbotSession(token, sessionId) {
  return apiClient(`/api/admin/chatbot/sessions/${sessionId}`, {
    method: "DELETE",
    token,
  });
}

export async function getChatbotAnalyticsOverview(token) {
  return apiClient("/api/admin/chatbot-analytics/overview", { token });
}
