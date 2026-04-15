export async function getAdminNotifications(token) {
  const response = await fetch("/api/auth/admin/notifications", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể tải thông báo admin");
  }

  return data;
}
