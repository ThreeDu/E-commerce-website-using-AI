export async function getAdminSystemLogs(token, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const queryString = query.toString();
  const endpoint = queryString
    ? `/api/auth/admin/system-logs?${queryString}`
    : "/api/auth/admin/system-logs";

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể lấy log hệ thống");
  }

  return data;
}
