/**
 * Customer chatbot API service (non-streaming calls; streaming lives in streamClient).
 */
import { apiClient } from "./apiClient";

export async function trackChatbotEvent(payload, token) {
  return apiClient("/api/chatbot/event", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function sendChatbotMessage(payload, token) {
  return apiClient("/api/chatbot/message", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function fetchChatHistory(sessionId, token) {
  return apiClient(`/api/chatbot/session/${encodeURIComponent(sessionId)}`, { token });
}
