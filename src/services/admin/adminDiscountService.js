import { apiClient } from "../apiClient";

export async function getAdminDiscounts(token) {
  return apiClient("/api/auth/admin/discounts", {
    token,
    errorMessage: "Không thể lấy danh sách mã giảm giá",
  });
}

export async function createAdminDiscount(token, payload) {
  return apiClient("/api/auth/admin/discounts", {
    method: "POST",
    body: payload,
    token,
    errorMessage: "Không thể thêm mã giảm giá",
  });
}

export async function getAdminDiscountById(token, discountId) {
  return apiClient(`/api/auth/admin/discounts/${discountId}`, {
    token,
    errorMessage: "Không thể lấy chi tiết mã giảm giá",
  });
}

export async function updateAdminDiscount(token, discountId, payload) {
  return apiClient(`/api/auth/admin/discounts/${discountId}`, {
    method: "PUT",
    body: payload,
    token,
    errorMessage: "Không thể cập nhật mã giảm giá",
  });
}

export async function deleteAdminDiscount(token, discountId) {
  return apiClient(`/api/auth/admin/discounts/${discountId}`, {
    method: "DELETE",
    token,
    errorMessage: "Không thể xóa mã giảm giá",
  });
}
