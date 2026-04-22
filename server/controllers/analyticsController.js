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

function toPercent(value, total) {
  if (!total) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(2));
}

function getStartOfDayInTimezone(days) {
  const now = new Date();
  const timezoneNow = new Date(now.toLocaleString("en-US", { timeZone: ANALYTICS_TIMEZONE }));
  const timezoneOffsetMs = now.getTime() - timezoneNow.getTime();

  const timezoneStart = new Date(timezoneNow);
  timezoneStart.setHours(0, 0, 0, 0);
  timezoneStart.setDate(timezoneStart.getDate() - (days - 1));

  return new Date(timezoneStart.getTime() + timezoneOffsetMs);
}

const getAdminFunnelOverview = async (req, res) => {
  try {
    const rawDays = Number(req.query?.days || 30);
    const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 180) : 30;

    const fromDate = getStartOfDayInTimezone(days);

    const eventStats = await AnalyticsEvent.aggregate([
      {
        $match: {
          occurredAt: { $gte: fromDate },
          eventName: { $in: FUNNEL_EVENTS },
        },
      },
      {
        $group: {
          _id: "$eventName",
          total: { $sum: 1 },
        },
      },
    ]);

    const totals = {
      product_view: 0,
      add_to_cart: 0,
      wishlist_add: 0,
      checkout_success: 0,
    };

    eventStats.forEach((item) => {
      totals[item._id] = Number(item.total || 0);
    });

    const uniqueIdentityDocs = await AnalyticsEvent.aggregate([
      {
        $match: {
          occurredAt: { $gte: fromDate },
          eventName: { $in: FUNNEL_EVENTS },
        },
      },
      {
        $project: {
          identityKey: {
            $cond: [
              { $ifNull: ["$userId", false] },
              { $concat: ["user:", { $toString: "$userId" }] },
              { $concat: ["anon:", "$anonymousId"] },
            ],
          },
        },
      },
      {
        $match: {
          identityKey: { $nin: ["anon:", ""] },
        },
      },
      {
        $group: {
          _id: "$identityKey",
        },
      },
      {
        $count: "total",
      },
    ]);

    const uniqueActors = Number(uniqueIdentityDocs[0]?.total || 0);

    const dailySeries = await AnalyticsEvent.aggregate([
      {
        $match: {
          occurredAt: { $gte: fromDate },
          eventName: { $in: FUNNEL_EVENTS },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$occurredAt",
                timezone: ANALYTICS_TIMEZONE,
              },
            },
            eventName: "$eventName",
          },
          total: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.day": 1,
        },
      },
    ]);

    const byDay = new Map();
    dailySeries.forEach((item) => {
      const day = item._id.day;
      const eventName = item._id.eventName;
      if (!byDay.has(day)) {
        byDay.set(day, {
          date: day,
          product_view: 0,
          add_to_cart: 0,
          wishlist_add: 0,
          checkout_success: 0,
        });
      }

      byDay.get(day)[eventName] = Number(item.total || 0);
    });

    return res.json({
      message: "Lấy funnel analytics thành công.",
      funnel: {
        filter: {
          days,
          fromDate,
          toDate: new Date(),
        },
        summary: {
          uniqueActors,
          productViews: totals.product_view,
          addToCart: totals.add_to_cart,
          wishlistAdds: totals.wishlist_add,
          checkoutSuccess: totals.checkout_success,
          viewToCartRate: toPercent(totals.add_to_cart, totals.product_view),
          cartToCheckoutRate: toPercent(totals.checkout_success, totals.add_to_cart),
          viewToCheckoutRate: toPercent(totals.checkout_success, totals.product_view),
        },
        series: Array.from(byDay.values()),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createAnalyticsEvent,
  getAdminFunnelOverview,
};
