const jwt = require("jsonwebtoken");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Order = require("../models/Order");
const Notification = require("../models/Notification");
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

const getMyWeeklyStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Calculate weekly visits
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const weeklySessions = await AnalyticsEvent.find({
      userId,
      occurredAt: { $gte: startOfWeek }
    }).distinct("sessionId");
    const weeklyVisits = weeklySessions.length;

    // 2. Calculate spending and orders (lifetime)
    const orders = await Order.find({ user: userId });
    const totalOrders = orders.length;
    const totalSpent = orders
      .filter(order => order.status !== "cancelled")
      .reduce((sum, order) => sum + (order.totalPrice || 0), 0);

    // 3. Calculate weekly spend by day (for weekly chart, Monday to Sunday)
    const weeklySpendsByDay = [0, 0, 0, 0, 0, 0, 0];
    const weeklyOrders = orders.filter(order => {
      return order.createdAt >= startOfWeek && order.status !== "cancelled";
    });
    weeklyOrders.forEach(order => {
      const orderDay = new Date(order.createdAt).getDay();
      const mappedIndex = orderDay === 0 ? 6 : orderDay - 1;
      if (mappedIndex >= 0 && mappedIndex < 7) {
        weeklySpendsByDay[mappedIndex] += order.totalPrice || 0;
      }
    });

    // 4. Check & Generate Weekly Summary Notification
    const weeklyNotification = await Notification.findOne({
      user: userId,
      type: "system",
      title: { $regex: "Báo cáo hoạt động tuần của bạn", $options: "i" },
      createdAt: { $gte: startOfWeek }
    });

    if (!weeklyNotification && (weeklyVisits > 0 || weeklyOrders.length > 0)) {
      const visitText = weeklyVisits > 0 ? `ghé thăm cửa hàng ${weeklyVisits} lần` : "";
      const orderText = weeklyOrders.length > 0 ? `đặt ${weeklyOrders.length} đơn hàng mới (trị giá ${weeklyOrders.reduce((s, o) => s + o.totalPrice, 0).toLocaleString("vi-VN")} đ)` : "";
      const comma = (visitText && orderText) ? ", " : "";

      if (visitText || orderText) {
        await Notification.create({
          user: userId,
          type: "system",
          title: "📊 Báo cáo hoạt động tuần của bạn",
          message: `Tuần này bạn đã ${visitText}${comma}${orderText}. Tổng chi tiêu trọn đời của bạn đạt ${totalSpent.toLocaleString("vi-VN")} đ. Cảm ơn bạn đã luôn ủng hộ chúng tôi!`,
          link: "/dashboard?tab=stats"
        });
      }
    }

    return res.json({
      message: "Lấy thống kê tuần thành công.",
      weeklyVisits,
      totalSpent,
      totalOrders,
      weeklySpendsByDay,
      startOfWeek
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createAnalyticsEvent,
  getMyWeeklyStats,
};
