const express = require("express");
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
