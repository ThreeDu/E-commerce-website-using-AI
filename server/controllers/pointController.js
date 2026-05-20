const User = require("../models/User");
const PointHistory = require("../models/PointHistory");
const RewardTier = require("../models/RewardTier");
const Discount = require("../models/Discount");
const { verifyUserRequest } = require("../routes/helpers/authHelpers");

/**
 * GET /api/points/me
 * Lấy điểm hiện tại và lịch sử giao dịch gần đây
 */
const getMyPoints = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const user = await User.findById(authUser._id).select("loyaltyPoints");
    const history = await PointHistory.find({ user: authUser._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json({
      points: user?.loyaltyPoints || 0,
      history,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy thông tin điểm." });
  }
};

/**
 * GET /api/points/rewards
 * Lấy danh sách các mức đổi thưởng đang hoạt động
 */
const getRewards = async (req, res) => {
  try {
    const rewards = await RewardTier.find({ isActive: true })
      .sort({ pointsRequired: 1 })
      .lean();

    return res.json({ rewards });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh sách đổi thưởng." });
  }
};

/**
 * Tạo mã voucher ngẫu nhiên dạng RW-XXXXXXXX
 */
function generateRewardCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "RW-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/points/redeem
 * Đổi điểm → tạo voucher mới cho user
 */
const redeemPoints = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const { rewardTierId } = req.body;
    if (!rewardTierId) {
      return res.status(400).json({ message: "Vui lòng chọn mức đổi thưởng." });
    }

    // 1. Tìm RewardTier
    const tier = await RewardTier.findById(rewardTierId);
    if (!tier || !tier.isActive) {
      return res.status(404).json({ message: "Mức đổi thưởng không tồn tại hoặc đã tắt." });
    }

    // 2. Kiểm tra đủ điểm
    const user = await User.findById(authUser._id);
    if ((user.loyaltyPoints || 0) < tier.pointsRequired) {
      return res.status(400).json({
        message: `Bạn cần ${tier.pointsRequired} điểm nhưng chỉ có ${user.loyaltyPoints || 0} điểm.`,
      });
    }

    // 3. Tạo mã voucher duy nhất
    let code = generateRewardCode();
    let codeExists = await Discount.findOne({ code });
    let attempts = 0;
    while (codeExists && attempts < 10) {
      code = generateRewardCode();
      codeExists = await Discount.findOne({ code });
      attempts++;
    }

    // 4. Tạo Discount mới dành riêng cho user
    const now = new Date();
    const endDate = new Date(now.getTime() + tier.voucherValidDays * 24 * 60 * 60 * 1000);

    const discount = await Discount.create({
      code,
      type: tier.discountType,
      value: tier.discountValue,
      minOrderValue: tier.minOrderValue || 0,
      maxDiscountValue: tier.maxDiscountValue || 0,
      startDate: now,
      endDate,
      usageLimit: 1,
      usageLimitPerUser: 1,
      allowedUsers: [user._id],
      isActive: true,
    });

    // 5. Trừ điểm
    user.loyaltyPoints = Math.max(0, (user.loyaltyPoints || 0) - tier.pointsRequired);
    await user.save();

    // 6. Ghi lịch sử
    await PointHistory.create({
      user: user._id,
      amount: -tier.pointsRequired,
      type: "redeem",
      reason: `Đổi ${tier.pointsRequired} điểm → voucher ${code} (${tier.name})`,
      relatedDiscount: discount._id,
      balanceAfter: user.loyaltyPoints,
    });

    return res.status(201).json({
      message: `Đổi điểm thành công! Mã voucher: ${code}`,
      voucher: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        minOrderValue: discount.minOrderValue,
        maxDiscountValue: discount.maxDiscountValue,
        endDate: discount.endDate,
      },
      remainingPoints: user.loyaltyPoints,
    });
  } catch (error) {
    console.error("Error redeeming points:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi đổi điểm." });
  }
};

module.exports = {
  getMyPoints,
  getRewards,
  redeemPoints,
};
