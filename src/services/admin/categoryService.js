export async function getAdminCategories(token) {
  const response = await fetch("/api/auth/admin/categories", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy danh sách danh mục");
  }

  return data;
}

export async function createAdminCategory(token, payload) {
  const response = await fetch("/api/auth/admin/categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể thêm danh mục");
  }

  return data;
}

export async function updateAdminCategory(token, categoryId, payload) {
  const response = await fetch(`/api/auth/admin/categories/${categoryId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể cập nhật danh mục");
  }

  return data;
}

export async function deleteAdminCategory(token, categoryId) {
  const response = await fetch(`/api/auth/admin/categories/${categoryId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể xóa danh mục");
  }

  return data;
}
