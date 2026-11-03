import { apiClient } from "../apiClient";

const INTELLIGENCE_BASE = "/api/auth/admin/intelligence";
const RETENTION_BASE = `${INTELLIGENCE_BASE}/retention`;

export async function getIntelligenceOverview(token) {
  return apiClient(`${INTELLIGENCE_BASE}/overview`, { token });
}

export async function getIntelligenceSegments(token) {
  return apiClient(`${INTELLIGENCE_BASE}/segments`, { token });
}

export async function getIntelligenceClv(token) {
  return apiClient(`${INTELLIGENCE_BASE}/clv`, { token });
}

export async function getAbandonedCarts(token) {
  return apiClient(`${INTELLIGENCE_BASE}/abandoned-carts`, { token });
}

export async function getIntelligenceCustomers(token, { sort, order, limit }) {
  return apiClient(`${INTELLIGENCE_BASE}/customers?sort=${sort}&order=${order}&limit=${limit}`, { token });
}

export async function trainIntelligenceModels(token) {
  return apiClient(`${INTELLIGENCE_BASE}/train`, {
    method: "POST",
    token,
    errorMessage: "Training thất bại.",
  });
}

export async function getRetentionHistory(token) {
  return apiClient(`${RETENTION_BASE}/history`, { token });
}

export async function runRetentionIntervention(token, payload) {
  return apiClient(`${RETENTION_BASE}/run-intervention`, {
    method: "POST",
    body: payload,
    token,
    errorMessage: "Chạy chiến dịch can thiệp thất bại.",
  });
}

export async function sendCartReminders(token, payload) {
  return apiClient(`${RETENTION_BASE}/send-cart-reminders`, {
    method: "POST",
    body: payload,
    token,
    errorMessage: "Gửi nhắc nhở giỏ hàng thất bại.",
  });
}
