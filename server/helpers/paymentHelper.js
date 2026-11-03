/**
 * Thông tin chuyển khoản VietQR cho đơn chờ thanh toán (beepay / transfer), hoặc null.
 */
function buildPaymentConfig(order) {
  if (!["beepay", "transfer"].includes(order.paymentMethod) || order.status !== "pending") {
    return null;
  }

  const bankId = process.env.BANK_ID || "MB";
  const accountNo = process.env.BANK_ACCOUNT_NO || "008000888";
  const accountName = process.env.BANK_ACCOUNT_NAME || "NGUYEN VAN A";
  const prefix = process.env.BEEPAY_PREFIX || "DH";
  const description = `${prefix}${order._id}`;
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${
    order.totalPrice
  }&addInfo=${description}&accountName=${encodeURIComponent(accountName)}`;

  return { bankId, accountNo, accountName, description, qrUrl };
}

module.exports = { buildPaymentConfig };
