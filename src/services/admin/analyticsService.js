export async function getAdminFunnelOverview(token, options = {}) {
  const days = Number(options.days || 30);

  const response = await fetch(`/api/auth/admin/analytics/funnel?days=${encodeURIComponent(days)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Không thể tải dữ liệu analytics funnel");
  }

  return data;
}
