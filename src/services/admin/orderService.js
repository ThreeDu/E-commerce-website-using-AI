export async function getAdminOrders(token, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const queryString = query.toString();
  const endpoint = queryString ? `/api/auth/admin/orders?${queryString}` : "/api/auth/admin/orders";

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy danh sách đơn hàng");
  }

  return data;
}

export async function updateAdminOrderStatus(token, orderId, status) {
  const response = await fetch(`/api/auth/admin/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể cập nhật trạng thái đơn hàng");
  }

  return data;
}

export async function getAdminOrderById(token, orderId) {
  const response = await fetch(`/api/auth/admin/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy chi tiết đơn hàng");
  }

  return data;
}

export async function getAdminRevenueOverview(token, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const queryString = query.toString();
  const endpoint = queryString
    ? `/api/auth/admin/orders/revenue-overview?${queryString}`
    : "/api/auth/admin/orders/revenue-overview";

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy dữ liệu doanh thu");
  }

  return data;
}
