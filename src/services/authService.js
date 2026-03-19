export async function registerUser(payload) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Register failed");
  }

  return data;
}

export async function loginUser(payload) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  return data;
}

export async function verifyAdminToken(token) {
  const response = await fetch("/api/auth/verify-admin", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Xác thực admin thất bại");
  }

  return data;
}

export async function getAdminUsers(token) {
  const response = await fetch("/api/auth/admin/users", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy danh sách người dùng");
  }

  return data;
}

export async function updateAdminUser(token, userId, payload) {
  const response = await fetch(`/api/auth/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể cập nhật người dùng");
  }

  return data;
}

export async function deleteAdminUser(token, userId) {
  const response = await fetch(`/api/auth/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể xóa người dùng");
  }

  return data;
}

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
