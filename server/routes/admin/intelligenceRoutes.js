const express = require("express");
const {
  getIntelligenceOverview,
  getIntelligenceCustomers,
  triggerTraining,
} = require("../../controllers/customerIntelligenceController");

const router = express.Router();

router.get("/overview", getIntelligenceOverview);
router.get("/customers", getIntelligenceCustomers);
router.post("/train", triggerTraining);

module.exports = router;
