/**
 * User-facing order API service.
 */
import { apiClient } from "./apiClient";

export async function verifyCoupon(code, subtotal, token) {
  return apiClient(`/api/orders/coupon/${encodeURIComponent(code)}?subtotal=${subtotal}`, {
    token,
  });
}

export async function createOrder(orderData, token) {
  return apiClient("/api/orders", {
    method: "POST",
    body: orderData,
    token,
  });
}

export async function fetchMyOrders(token) {
  return apiClient("/api/orders/my-orders", { token });
}

export async function fetchMyOrderById(id, token) {
  return apiClient(`/api/orders/my-orders/${id}`, { token });
}

export async function cancelMyOrder(id, reason, token) {
  return apiClient(`/api/orders/my-orders/${id}/cancel`, {
    method: "PUT",
    body: { reason },
    token,
  });
}
