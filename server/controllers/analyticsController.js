const jwt = require("jsonwebtoken");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const { getTokenFromHeader } = require("../routes/helpers/authHelpers");

const ALLOWED_EVENTS = new Set([
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "wishlist_add",
  "wishlist_remove",
  "order_cancel",
  "checkout_success",
]);

const FUNNEL_EVENTS = ["product_view", "add_to_cart", "wishlist_add", "checkout_success"];
const ANALYTICS_TIMEZONE = "Asia/Ho_Chi_Minh";

function parseOptionalUserId(req) {
  const token = getTokenFromHeader(req);
  if (!token) {
    return null;
  }

  try {
    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const decoded = jwt.verify(token, secret);
    return decoded?.userId || null;
  } catch (error) {
    return null;
  }
}

const createAnalyticsEvent = async (req, res) => {
  try {
    const eventName = String(req.body?.eventName || "").trim();
    const anonymousId = String(req.body?.anonymousId || "").trim();
    const sessionId = String(req.body?.sessionId || "").trim();
    const pagePath = String(req.body?.pagePath || "").trim();
    const source = String(req.body?.source || "web").trim();
    const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};

    if (!eventName) {
      return res.status(400).json({ message: "eventName là bắt buộc." });
    }

    if (!ALLOWED_EVENTS.has(eventName)) {
      return res.status(400).json({ message: "eventName không hợp lệ." });
    }

    const userId = parseOptionalUserId(req);

    await AnalyticsEvent.create({
      eventName,
      userId,
      anonymousId,
      sessionId,
      pagePath,
      source,
      metadata,
      occurredAt: new Date(),
    });

    return res.status(201).json({ message: "Ghi nhận hành vi thành công." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createAnalyticsEvent,
};
