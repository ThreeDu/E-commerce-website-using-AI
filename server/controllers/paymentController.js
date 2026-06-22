const crypto = require("crypto");
const Order = require("../models/Order");
const { notifyOrderStatusChange } = require("../helpers/notificationHelper");

const handleBeepayWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-beepay-signature"] || req.headers["x-webhook-signature"];
    if (!signature) {
      console.warn("[BeePay Webhook] Missing signature header.");
      return res.status(401).json({ message: "Missing signature" });
    }

    const hashValue = signature.startsWith("sha256=") ? signature.split("=")[1] : signature;
    const payload = req.rawBody || JSON.stringify(req.body);

    const secret = process.env.BEEPAY_HMAC_SECRET || "819444abb8ccfcd60fcc18583e9cff2b706e8e57d10dcb80101b570cd1b563c8";
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    if (hashValue !== expectedSignature) {
      console.warn("[BeePay Webhook] Signature verification failed.");
      return res.status(403).json({ message: "Invalid signature" });
    }

    // Trích xuất mã đơn hàng 24 ký tự hex (ObjectId của MongoDB) từ order_id hoặc description
    const hex24Regex = /[0-9a-fA-F]{24}/;
    let orderId = "";

    if (req.body.order_id) {
      const match = String(req.body.order_id).match(hex24Regex);
      if (match) orderId = match[0];
    }

    if (!orderId && req.body.description) {
      const match = String(req.body.description).match(hex24Regex);
      if (match) orderId = match[0];
    }

    if (!orderId) {
      console.warn("[BeePay Webhook] No valid 24-character order ID found in webhook payload:", req.body);
      return res.status(400).json({ message: "Could not find a valid order ID in payload" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      console.warn(`[BeePay Webhook] Order not found: ${orderId}`);
      return res.status(404).json({ message: "Order not found" });
    }

    // Nếu đơn hàng đã được xử lý (không phải pending), trả về thành công để tránh BeePay gửi lại liên tục
    if (order.status !== "pending") {
      console.info(`[BeePay Webhook] Order ${orderId} already processed (status: ${order.status}).`);
      return res.status(200).json({ message: "Order already processed" });
    }

    const amount = parseFloat(req.body.amount || 0);
    // So sánh số tiền (làm tròn để tránh sai số dấu phẩy động)
    if (Math.round(amount) < Math.round(order.totalPrice)) {
      console.warn(`[BeePay Webhook] Insufficient amount. Received: ${amount}, Expected: ${order.totalPrice}`);
      return res.status(400).json({ message: "Insufficient payment amount" });
    }

    // Cập nhật trạng thái đơn hàng
    order.status = "confirmed";
    order.isPaid = true;
    order.paidAt = new Date();
    order.paymentDetails = {
      transactionRef: req.body.transaction_ref || String(req.body.transaction_id || ""),
      bankCode: req.body.bank_code || "",
      amount: amount,
      counterpartName: req.body.counterpart_name || "",
    };

    await order.save();
    console.info(`[BeePay Webhook] Order ${orderId} paid and confirmed successfully.`);

    // Gửi thông báo cập nhật trạng thái đơn hàng
    notifyOrderStatusChange(order, "confirmed").catch((err) =>
      console.error("[BeePay Webhook] Send notification failed:", err)
    );

    return res.status(200).json({ message: "Payment verified successfully" });
  } catch (error) {
    console.error("[BeePay Webhook] Internal server error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  handleBeepayWebhook,
};
