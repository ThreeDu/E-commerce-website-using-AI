/**
 * Shared order-status display helpers.
 *
 * Previously duplicated in OrderHistoryPage and OrderDetailPage.
 */

/**
 * Derive a user-friendly label and colour scheme for an order's status.
 *
 * @param {object} order
 * @returns {{ label: string, bg: string, color: string }}
 */
export function getStatusInfo(order) {
  const status = String(order?.status || "").trim() || (order?.isDelivered ? "delivered" : "pending");

  if (status === "delivered") {
    return { label: "Đã giao", bg: "#dcfce7", color: "#166534" };
  }

  if (status === "shipping") {
    return { label: "Đang giao", bg: "#dbeafe", color: "#1d4ed8" };
  }

  if (status === "confirmed") {
    return { label: "Đã xác nhận", bg: "#fef3c7", color: "#b45309" };
  }

  if (status === "cancelled") {
    return { label: "Đã hủy", bg: "#fee2e2", color: "#b91c1c" };
  }

  return { label: "Chờ xử lý", bg: "#ede9fe", color: "#5b21b6" };
}
