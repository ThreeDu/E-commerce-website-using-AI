import { apiClient } from "../apiClient";

export async function getAdminCategories(token) {
  return apiClient("/api/auth/admin/categories", {
    token,
    errorMessage: "Không thể lấy danh sách danh mục",
  });
}

export async function createAdminCategory(token, payload) {
  return apiClient("/api/auth/admin/categories", {
    method: "POST",
    body: payload,
    token,
    errorMessage: "Không thể thêm danh mục",
  });
}

export async function updateAdminCategory(token, categoryId, payload) {
  return apiClient(`/api/auth/admin/categories/${categoryId}`, {
    method: "PUT",
    body: payload,
    token,
    errorMessage: "Không thể cập nhật danh mục",
  });
}

export async function deleteAdminCategory(token, categoryId) {
  return apiClient(`/api/auth/admin/categories/${categoryId}`, {
    method: "DELETE",
    token,
    errorMessage: "Không thể xóa danh mục",
  });
}
