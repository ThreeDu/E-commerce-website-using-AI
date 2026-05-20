const RewardTier = require("../../models/RewardTier");
const { logAdminAction } = require("../../utils/adminAuditLogger");

const listRewardTiers = async (req, res) => {
  try {
    const tiers = await RewardTier.find().sort({ pointsRequired: 1 }).lean();
    return res.json({ message: "Lấy danh sách mức đổi thưởng thành công.", tiers });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getRewardTierById = async (req, res) => {
  try {
    const tier = await RewardTier.findById(req.params.id);
    if (!tier) {
      return res.status(404).json({ message: "Không tìm thấy mức đổi thưởng." });
    }
    return res.json({ message: "Lấy chi tiết mức đổi thưởng thành công.", tier });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createRewardTier = async (req, res) => {
  try {
    const {
      name,
      pointsRequired,
      discountType,
      discountValue,
      maxDiscountValue,
      minOrderValue,
      voucherValidDays,
      isActive,
    } = req.body;

    if (!name || !pointsRequired || !discountValue) {
      return res.status(400).json({ message: "Tên, số điểm cần, và giá trị giảm là bắt buộc." });
    }

    if (!["percent", "fixed"].includes(discountType)) {
      return res.status(400).json({ message: "Loại giảm giá không hợp lệ." });
    }

    if (discountType === "percent" && Number(discountValue) > 100) {
      return res.status(400).json({ message: "Giảm giá theo % không được vượt quá 100." });
    }

    const tier = await RewardTier.create({
      name: String(name).trim(),
      pointsRequired: Number(pointsRequired),
      discountType,
      discountValue: Number(discountValue),
      maxDiscountValue: Number(maxDiscountValue || 0),
      minOrderValue: Number(minOrderValue || 0),
      voucherValidDays: Number(voucherValidDays || 30),
      isActive: isActive !== false,
    });

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "create",
      resource: "rewardTier",
      resourceId: tier._id,
      details: { name: tier.name, pointsRequired: tier.pointsRequired },
    });

    return res.status(201).json({ message: "Tạo mức đổi thưởng thành công.", tier });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateRewardTier = async (req, res) => {
  try {
    const {
      name,
      pointsRequired,
      discountType,
      discountValue,
      maxDiscountValue,
      minOrderValue,
      voucherValidDays,
      isActive,
    } = req.body;

    if (discountType && !["percent", "fixed"].includes(discountType)) {
      return res.status(400).json({ message: "Loại giảm giá không hợp lệ." });
    }

    if (discountType === "percent" && Number(discountValue) > 100) {
      return res.status(400).json({ message: "Giảm giá theo % không được vượt quá 100." });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (pointsRequired !== undefined) updateData.pointsRequired = Number(pointsRequired);
    if (discountType !== undefined) updateData.discountType = discountType;
    if (discountValue !== undefined) updateData.discountValue = Number(discountValue);
    if (maxDiscountValue !== undefined) updateData.maxDiscountValue = Number(maxDiscountValue);
    if (minOrderValue !== undefined) updateData.minOrderValue = Number(minOrderValue);
    if (voucherValidDays !== undefined) updateData.voucherValidDays = Number(voucherValidDays);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const tier = await RewardTier.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!tier) {
      return res.status(404).json({ message: "Không tìm thấy mức đổi thưởng." });
    }

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "update",
      resource: "rewardTier",
      resourceId: tier._id,
      details: { name: tier.name },
    });

    return res.json({ message: "Cập nhật mức đổi thưởng thành công.", tier });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteRewardTier = async (req, res) => {
  try {
    const tier = await RewardTier.findByIdAndDelete(req.params.id);
    if (!tier) {
      return res.status(404).json({ message: "Không tìm thấy mức đổi thưởng." });
    }

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "delete",
      resource: "rewardTier",
      resourceId: tier._id,
      details: { name: tier.name },
    });

    return res.json({ message: "Xóa mức đổi thưởng thành công." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listRewardTiers,
  getRewardTierById,
  createRewardTier,
  updateRewardTier,
  deleteRewardTier,
};
