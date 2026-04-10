async function parseResponseSafely(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    return {
      message: rawText.startsWith("<!DOCTYPE")
        ? "Server trả về HTML thay vì JSON. Vui lòng kiểm tra server API hoặc payload gửi lên."
        : rawText,
    };
  }
}

export async function getAdminProducts(token) {
  const response = await fetch("/api/auth/admin/products", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseResponseSafely(response);
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

  const data = await parseResponseSafely(response);
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

  const data = await parseResponseSafely(response);
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

  const data = await parseResponseSafely(response);
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

  const data = await parseResponseSafely(response);
  if (!response.ok) {
    throw new Error(data.message || "Không thể xóa sản phẩm");
  }

  return data;
}
