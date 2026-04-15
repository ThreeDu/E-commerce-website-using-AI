const Discount = require("../../models/Discount");
const { logAdminAction } = require("../../utils/adminAuditLogger");

const normalizeDiscountPayload = ({
  code,
  type,
  value,
  minOrderValue,
  maxDiscountValue,
  startDate,
  endDate,
  usageLimit,
  isActive,
}) => {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const numericValue = Number(value || 0);
  const numericMinOrderValue = Number(minOrderValue || 0);
  const numericMaxDiscountValue = Number(maxDiscountValue || 0);
  const numericUsageLimit = Number(usageLimit || 0);

  return {
    normalizedCode,
    type,
    numericValue,
    numericMinOrderValue,
    numericMaxDiscountValue,
    numericUsageLimit,
    hasStartDate: Boolean(startDate),
    hasEndDate: Boolean(endDate),
    startDate,
    endDate,
    isActive: Boolean(isActive),
  };
};

const validateDiscountPayload = ({
  normalizedCode,
  type,
  numericValue,
  numericMinOrderValue,
  numericMaxDiscountValue,
  numericUsageLimit,
  hasStartDate,
  hasEndDate,
  startDate,
  endDate,
}) => {
  if (!normalizedCode) {
    return { status: 400, message: "Mã giảm giá là bắt buộc." };
  }

  if (!["percent", "fixed"].includes(type)) {
    return { status: 400, message: "Loại giảm giá không hợp lệ." };
  }

  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return { status: 400, message: "Giá trị giảm giá không hợp lệ." };
  }

  if (type === "percent" && numericValue > 100) {
    return { status: 400, message: "Giảm giá theo % không được lớn hơn 100." };
  }

  if (Number.isNaN(numericMinOrderValue) || numericMinOrderValue < 0) {
    return { status: 400, message: "Giá trị đơn hàng tối thiểu không hợp lệ." };
  }

  if (Number.isNaN(numericMaxDiscountValue) || numericMaxDiscountValue < 0) {
    return { status: 400, message: "Mức giảm tối đa không hợp lệ." };
  }

  if (Number.isNaN(numericUsageLimit) || numericUsageLimit < 0) {
    return { status: 400, message: "Số lượt sử dụng tối đa không hợp lệ." };
  }

  if (hasStartDate !== hasEndDate) {
    return { status: 400, message: "Vui lòng nhập đầy đủ cả ngày bắt đầu và ngày kết thúc." };
  }

  if (hasStartDate && hasEndDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return { status: 400, message: "Khoảng thời gian áp dụng không hợp lệ." };
    }

    return { start, end };
  }

  return { start: null, end: null };
};

const listDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách mã giảm giá thành công.",
      discounts,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;
    const discount = await Discount.findById(id);

    if (!discount) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
    }

    return res.json({
      message: "Lấy chi tiết mã giảm giá thành công.",
      discount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createDiscount = async (req, res) => {
  try {
    const normalizedPayload = normalizeDiscountPayload(req.body);
    const validation = validateDiscountPayload(normalizedPayload);

    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const existedCode = await Discount.findOne({ code: normalizedPayload.normalizedCode });
    if (existedCode) {
      return res.status(409).json({ message: "Mã giảm giá đã tồn tại." });
    }

    const discount = await Discount.create({
      code: normalizedPayload.normalizedCode,
      type: normalizedPayload.type,
      value: normalizedPayload.numericValue,
      minOrderValue: normalizedPayload.numericMinOrderValue,
      maxDiscountValue: normalizedPayload.numericMaxDiscountValue,
      startDate: normalizedPayload.hasStartDate ? validation.start : null,
      endDate: normalizedPayload.hasEndDate ? validation.end : null,
      usageLimit: normalizedPayload.numericUsageLimit,
      isActive: normalizedPayload.isActive,
    });

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "create",
      resource: "discount",
      resourceId: discount._id,
      details: {
        code: discount.code,
        type: discount.type,
        isActive: discount.isActive,
      },
    });

    return res.status(201).json({
      message: "Thêm mã giảm giá thành công.",
      discount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const normalizedPayload = normalizeDiscountPayload(req.body);
    const validation = validateDiscountPayload(normalizedPayload);

    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const existedCode = await Discount.findOne({
      code: normalizedPayload.normalizedCode,
      _id: { $ne: id },
    });
    if (existedCode) {
      return res.status(409).json({ message: "Mã giảm giá đã tồn tại." });
    }

    const updatedDiscount = await Discount.findByIdAndUpdate(
      id,
      {
        code: normalizedPayload.normalizedCode,
        type: normalizedPayload.type,
        value: normalizedPayload.numericValue,
        minOrderValue: normalizedPayload.numericMinOrderValue,
        maxDiscountValue: normalizedPayload.numericMaxDiscountValue,
        startDate: normalizedPayload.hasStartDate ? validation.start : null,
        endDate: normalizedPayload.hasEndDate ? validation.end : null,
        usageLimit: normalizedPayload.numericUsageLimit,
        isActive: normalizedPayload.isActive,
      },
      { new: true, runValidators: true }
    );

    if (!updatedDiscount) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
    }

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "update",
      resource: "discount",
      resourceId: updatedDiscount._id,
      details: {
        code: updatedDiscount.code,
        type: updatedDiscount.type,
        isActive: updatedDiscount.isActive,
      },
    });

    return res.json({
      message: "Cập nhật mã giảm giá thành công.",
      discount: updatedDiscount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedDiscount = await Discount.findByIdAndDelete(id);

    if (!deletedDiscount) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
    }

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "delete",
      resource: "discount",
      resourceId: deletedDiscount._id,
      details: {
        code: deletedDiscount.code,
        type: deletedDiscount.type,
      },
    });

    return res.json({
      message: "Xóa mã giảm giá thành công.",
      discount: deletedDiscount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
};
