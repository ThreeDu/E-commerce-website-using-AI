import { apiClient, buildQueryString } from "../apiClient";

export async function getAdminOrders(token, params = {}) {
  return apiClient(`/api/auth/admin/orders${buildQueryString(params)}`, {
    token,
    errorMessage: "Không thể lấy danh sách đơn hàng",
  });
}

export async function updateAdminOrderStatus(token, orderId, status) {
  return apiClient(`/api/auth/admin/orders/${orderId}/status`, {
    method: "PUT",
    body: { status },
    token,
    errorMessage: "Không thể cập nhật trạng thái đơn hàng",
  });
}

export async function getAdminOrderById(token, orderId) {
  return apiClient(`/api/auth/admin/orders/${orderId}`, {
    token,
    errorMessage: "Không thể lấy chi tiết đơn hàng",
  });
}

export async function getAdminRevenueOverview(token, params = {}) {
  return apiClient(`/api/auth/admin/orders/revenue-overview${buildQueryString(params)}`, {
    token,
    errorMessage: "Không thể lấy dữ liệu doanh thu",
  });
}
