export async function getAdminDiscounts(token) {
  const response = await fetch("/api/auth/admin/discounts", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy danh sách mã giảm giá");
  }

  return data;
}

export async function createAdminDiscount(token, payload) {
  const response = await fetch("/api/auth/admin/discounts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể thêm mã giảm giá");
  }

  return data;
}

export async function getAdminDiscountById(token, discountId) {
  const response = await fetch(`/api/auth/admin/discounts/${discountId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy chi tiết mã giảm giá");
  }

  return data;
}

export async function updateAdminDiscount(token, discountId, payload) {
  const response = await fetch(`/api/auth/admin/discounts/${discountId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể cập nhật mã giảm giá");
  }

  return data;
}

export async function deleteAdminDiscount(token, discountId) {
  const response = await fetch(`/api/auth/admin/discounts/${discountId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể xóa mã giảm giá");
  }

  return data;
}
