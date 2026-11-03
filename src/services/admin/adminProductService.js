import { apiClient } from "../apiClient";

export async function getAdminProducts(token) {
  return apiClient("/api/auth/admin/products", {
    token,
    errorMessage: "Không thể lấy danh sách sản phẩm",
  });
}

export async function getAdminProductById(token, productId) {
  return apiClient(`/api/auth/admin/products/${productId}`, {
    token,
    errorMessage: "Không thể lấy chi tiết sản phẩm",
  });
}

export async function createAdminProduct(token, payload) {
  return apiClient("/api/auth/admin/products", {
    method: "POST",
    body: payload,
    token,
    errorMessage: "Không thể thêm sản phẩm",
  });
}

export async function updateAdminProduct(token, productId, payload) {
  return apiClient(`/api/auth/admin/products/${productId}`, {
    method: "PUT",
    body: payload,
    token,
    errorMessage: "Không thể cập nhật sản phẩm",
  });
}

export async function deleteAdminProduct(token, productId) {
  return apiClient(`/api/auth/admin/products/${productId}`, {
    method: "DELETE",
    token,
    errorMessage: "Không thể xóa sản phẩm",
  });
}

export async function previewAdminProductImport(token, rows) {
  return apiClient("/api/auth/admin/products/import/preview", {
    method: "POST",
    body: { rows },
    token,
    errorMessage: "Không thể phân tích file import sản phẩm",
  });
}

export async function commitAdminProductImport(token, rows, mode = "create") {
  return apiClient("/api/auth/admin/products/import/commit", {
    method: "POST",
    body: { rows, mode },
    token,
    errorMessage: "Không thể import sản phẩm",
  });
}
