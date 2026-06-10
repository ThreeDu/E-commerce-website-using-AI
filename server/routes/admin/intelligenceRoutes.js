const express = require("express");
const { verifyAdminRequest } = require("../helpers/authHelpers");
const {
  getIntelligenceOverview,
  getIntelligenceCustomers,
  triggerTraining,
  getCustomerSegments,
  getCustomerCLV,
  getAbandonedCarts,
} = require("../../controllers/customerIntelligenceController");
const {
  runChurnIntervention,
  sendCartReminders,
  getCampaignHistory,
} = require("../../controllers/admin/retentionController");

const router = express.Router();

const requireAdmin = async (req, res, next) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  req.adminUser = adminUser;
  next();
};

router.use(requireAdmin);

router.get("/overview", getIntelligenceOverview);
router.get("/customers", getIntelligenceCustomers);
router.post("/train", triggerTraining);

// Intelligence Proxies
router.get("/segments", getCustomerSegments);
router.get("/clv", getCustomerCLV);
router.get("/abandoned-carts", getAbandonedCarts);

// Retention Campaign Routes
router.post("/retention/run-intervention", runChurnIntervention);
router.post("/retention/send-cart-reminders", sendCartReminders);
router.get("/retention/history", getCampaignHistory);

module.exports = router;
