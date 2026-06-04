const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { processChatMessage, trackChatbotEvent, debugGreeting } = require("./service");
const { getTokenFromHeader } = require("../routes/helpers/authHelpers");

function isDebugGreetingEnabled() {
  const value = String(process.env.CHATBOT_DEBUG_GREETING_ENABLED || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function getOptionalUserId(req) {
  const token = getTokenFromHeader(req);
  if (!token) {
    return null;
  }

  try {
    const secret = process.env.JWT_SECRET || "dev_secret_change_me";
    const decoded = jwt.verify(token, secret);
    const userId = String(decoded?.userId || "").trim();
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }

    return userId;
  } catch (error) {
    return null;
  }
}

const chatWithAssistant = async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const sessionId = String(req.body?.sessionId || "").trim();
    const context = req.body?.context || {};
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!message) {
      return res.status(400).json({ message: "Tin nhắn không được để trống." });
    }

    const result = await processChatMessage({
      message,
      sessionId,
      context,
      history,
      userId: getOptionalUserId(req),
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Không thể xử lý chatbot lúc này.",
    });
  }
};

const trackEvent = async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || "").trim();
    const eventType = String(req.body?.eventType || "").trim();
    const productId = String(req.body?.productId || "").trim();
    const category = String(req.body?.category || "").trim();
    const queryText = String(req.body?.queryText || "").trim();
    const metadata = req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {};

    if (!sessionId || !eventType) {
      return res.status(400).json({ message: "sessionId và eventType là bắt buộc." });
    }

    await trackChatbotEvent({
      sessionId,
      eventType,
      productId,
      category,
      queryText,
      metadata,
      userId: getOptionalUserId(req),
    });

    return res.status(201).json({ message: "Ghi nhận event thành công." });
  } catch (error) {
    return res.status(500).json({ message: "Không thể ghi nhận event chatbot." });
  }
};

// exports are declared at end (including debugGreeting)

const debugGreetingController = async (req, res) => {
  try {
    if (!isDebugGreetingEnabled()) {
      return res.status(404).json({ message: "Debug greeting is disabled." });
    }

    const mode = String(req.body?.mode || req.query?.mode || "anonymous").trim().toLowerCase();
    const sessionId = String(req.body?.sessionId || "").trim() || null;

    if (!["anonymous", "churn", "vip"].includes(mode)) {
      return res.status(400).json({ message: "mode phải là one of: anonymous|churn|vip" });
    }

    const result = await debugGreeting({ mode, sessionId });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: "Không thể tạo debug greeting." });
  }
};

module.exports = {
  chatWithAssistant,
  trackEvent,
  debugGreeting: debugGreetingController,
};
