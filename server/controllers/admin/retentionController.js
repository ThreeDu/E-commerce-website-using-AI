const Discount = require("../../models/Discount");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const { notifyChurnIntervention, notifyAbandonedCart } = require("../../helpers/notificationHelper");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

const callMlService = async (path, method = "GET", body = null) => {
  const url = `${ML_SERVICE_URL}${path}`;
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML Service error (${response.status}): ${errorText}`);
  }
  return await response.json();
};

const generateRandomCode = (prefix = "WINBACK", length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${result}`;
};

/**
 * runChurnIntervention
 * 1. Calls ML service POST /api/intelligence/retention/auto-intervene
 * 2. Processes targets: if action is 'voucher', creates a personalized Discount
 * 3. Sends notification to the user
 */
const runChurnIntervention = async (req, res) => {
  try {
    const { churnThreshold = 50, cooldownDays = 7, maxTargets = 20 } = req.body;

    // Call ML service to select targets
    const mlResponse = await callMlService("/api/intelligence/retention/auto-intervene", "POST", {
      churn_threshold: churnThreshold,
      cooldown_days: cooldownDays,
      max_targets: maxTargets,
    });

    const targets = mlResponse.targets || [];
    const results = [];
    let vouchersCreated = 0;

    for (const target of targets) {
      let createdVoucher = null;

      if (target.recommended_action === "voucher" && target.recommended_discount) {
        const voucherCode = generateRandomCode("WINBACK", 8);
        const discountType = target.recommended_discount.type; // "percent" or "fixed"
        const discountValue = target.recommended_discount.value;
        const minOrder = target.recommended_discount.min_order;

        try {
          createdVoucher = await Discount.create({
            code: voucherCode,
            type: discountType,
            value: discountValue,
            minOrderValue: minOrder,
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days valid
            usageLimit: 1,
            usageLimitPerUser: 1,
            allowedUsers: [target.user_id],
            isActive: true,
          });
          vouchersCreated++;
        } catch (voucherErr) {
          console.error(`Error creating discount for user ${target.user_id}:`, voucherErr);
        }
      }

      // Send Churn Intervention Notification
      try {
        await notifyChurnIntervention(target.user_id, createdVoucher);
      } catch (notifErr) {
        console.error(`Error sending notification to user ${target.user_id}:`, notifErr);
      }

      results.push({
        userId: target.user_id,
        userName: target.user_name,
        email: target.user_email,
        churnScore: target.churn_score,
        clvScore: target.clv_score,
        segment: target.segment,
        action: target.recommended_action,
        voucherCode: createdVoucher ? createdVoucher.code : null,
      });
    }

    return res.status(200).json({
      success: true,
      targetsCount: targets.length,
      vouchersCreated,
      campaignType: "churn_intervention",
      results,
    });
  } catch (error) {
    console.error("Error in runChurnIntervention:", error);
    return res.status(500).json({
      success: false,
      message: "Error running churn intervention campaign",
      error: error.message,
    });
  }
};

/**
 * sendCartReminders
 * 1. Calls ML service GET /api/intelligence/abandoned-carts
 * 2. Sends reminder notifications. If includeDiscount is true, creates a discount voucher.
 */
const sendCartReminders = async (req, res) => {
  try {
    const { hours = 24, includeDiscount = false, discountType = "percent", discountValue = 10 } = req.body;

    const mlResponse = await callMlService(`/api/intelligence/abandoned-carts?hours=${hours}`, "GET");
    const carts = mlResponse.carts || [];
    const results = [];
    let remindersSent = 0;
    let vouchersCreated = 0;

    for (const cart of carts) {
      let createdVoucher = null;

      if (includeDiscount) {
        const voucherCode = generateRandomCode("RECOVER", 8);
        try {
          createdVoucher = await Discount.create({
            code: voucherCode,
            type: discountType,
            value: discountValue,
            minOrderValue: cart.estimated_value > 300000 ? 200000 : 0, // dynamic minimum order
            startDate: new Date(),
            endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days valid for urgency
            usageLimit: 1,
            usageLimitPerUser: 1,
            allowedUsers: [cart.user_id],
            isActive: true,
          });
          vouchersCreated++;
        } catch (voucherErr) {
          console.error(`Error creating discount for abandoned cart of user ${cart.user_id}:`, voucherErr);
        }
      }

      // Send cart reminder notification
      try {
        const cartData = {
          itemsCount: cart.items.length,
          estimatedValue: cart.estimated_value,
          voucherCode: createdVoucher ? createdVoucher.code : null,
        };
        await notifyAbandonedCart(cart.user_id, cartData);
        remindersSent++;
      } catch (notifErr) {
        console.error(`Error sending cart reminder to user ${cart.user_id}:`, notifErr);
      }

      results.push({
        userId: cart.user_id,
        userName: cart.user_name,
        email: cart.user_email,
        itemsCount: cart.items.length,
        estimatedValue: cart.estimated_value,
        hoursAbandoned: cart.hours_abandoned,
        priorityScore: cart.priority_score,
        voucherCode: createdVoucher ? createdVoucher.code : null,
      });
    }

    return res.status(200).json({
      success: true,
      cartsChecked: carts.length,
      remindersSent,
      vouchersCreated,
      campaignType: "abandoned_cart",
      results,
    });
  } catch (error) {
    console.error("Error in sendCartReminders:", error);
    return res.status(500).json({
      success: false,
      message: "Error sending abandoned cart reminders",
      error: error.message,
    });
  }
};

/**
 * getCampaignHistory
 * Fetches campaign history by querying notifications of type churn_intervention and abandoned_cart
 */
const getCampaignHistory = async (req, res) => {
  try {
    const notifications = await Notification.find({
      type: { $in: ["churn_intervention", "abandoned_cart"] },
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error in getCampaignHistory:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching campaign history",
      error: error.message,
    });
  }
};

module.exports = {
  runChurnIntervention,
  sendCartReminders,
  getCampaignHistory,
};
