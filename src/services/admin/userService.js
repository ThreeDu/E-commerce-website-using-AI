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
