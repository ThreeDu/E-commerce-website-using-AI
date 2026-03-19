export async function getAdminProducts(token) {
  const response = await fetch("/api/auth/admin/products", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy danh sách sản phẩm");
  }

  return data;
}

export async function getAdminProductById(token, productId) {
  const response = await fetch(`/api/auth/admin/products/${productId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy chi tiết sản phẩm");
  }

  return data;
}

export async function createAdminProduct(token, payload) {
  const response = await fetch("/api/auth/admin/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể thêm sản phẩm");
  }

  return data;
}

export async function updateAdminProduct(token, productId, payload) {
  const response = await fetch(`/api/auth/admin/products/${productId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể cập nhật sản phẩm");
  }

  return data;
}

export async function deleteAdminProduct(token, productId) {
  const response = await fetch(`/api/auth/admin/products/${productId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể xóa sản phẩm");
  }

  return data;
}
