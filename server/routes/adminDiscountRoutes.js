const express = require("express");
const Discount = require("../models/Discount");
const { verifyAdminRequest } = require("./helpers/authHelpers");
const { logAdminAction } = require("../utils/adminAuditLogger");

const router = express.Router();

router.get("/", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách mã giảm giá thành công.",
      discounts,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

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
});

router.post("/", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const {
      code,
      type,
      value,
      minOrderValue,
      maxDiscountValue,
      startDate,
      endDate,
      usageLimit,
      isActive,
    } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({ message: "Mã giảm giá là bắt buộc." });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const numericValue = Number(value || 0);
    const numericMinOrderValue = Number(minOrderValue || 0);
    const numericMaxDiscountValue = Number(maxDiscountValue || 0);
    const numericUsageLimit = Number(usageLimit || 0);

    if (!["percent", "fixed"].includes(type)) {
      return res.status(400).json({ message: "Loại giảm giá không hợp lệ." });
    }

    if (Number.isNaN(numericValue) || numericValue <= 0) {
      return res.status(400).json({ message: "Giá trị giảm giá không hợp lệ." });
    }

    if (type === "percent" && numericValue > 100) {
      return res.status(400).json({ message: "Giảm giá theo % không được lớn hơn 100." });
    }

    if (Number.isNaN(numericMinOrderValue) || numericMinOrderValue < 0) {
      return res.status(400).json({ message: "Giá trị đơn hàng tối thiểu không hợp lệ." });
    }

    if (Number.isNaN(numericMaxDiscountValue) || numericMaxDiscountValue < 0) {
      return res.status(400).json({ message: "Mức giảm tối đa không hợp lệ." });
    }

    if (Number.isNaN(numericUsageLimit) || numericUsageLimit < 0) {
      return res.status(400).json({ message: "Số lượt sử dụng tối đa không hợp lệ." });
    }

    const hasStartDate = Boolean(startDate);
    const hasEndDate = Boolean(endDate);

    if (hasStartDate !== hasEndDate) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ cả ngày bắt đầu và ngày kết thúc." });
    }

    let start;
    let end;
    if (hasStartDate && hasEndDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return res.status(400).json({ message: "Khoảng thời gian áp dụng không hợp lệ." });
      }
    }

    const existedCode = await Discount.findOne({ code: normalizedCode });
    if (existedCode) {
      return res.status(409).json({ message: "Mã giảm giá đã tồn tại." });
    }

    const discount = await Discount.create({
      code: normalizedCode,
      type,
      value: numericValue,
      minOrderValue: numericMinOrderValue,
      maxDiscountValue: numericMaxDiscountValue,
      startDate: hasStartDate ? start : null,
      endDate: hasEndDate ? end : null,
      usageLimit: numericUsageLimit,
      isActive: Boolean(isActive),
    });

    logAdminAction({
      req,
      adminUser,
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
});

router.put("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const {
      code,
      type,
      value,
      minOrderValue,
      maxDiscountValue,
      startDate,
      endDate,
      usageLimit,
      isActive,
    } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({ message: "Mã giảm giá là bắt buộc." });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const numericValue = Number(value || 0);
    const numericMinOrderValue = Number(minOrderValue || 0);
    const numericMaxDiscountValue = Number(maxDiscountValue || 0);
    const numericUsageLimit = Number(usageLimit || 0);

    if (!["percent", "fixed"].includes(type)) {
      return res.status(400).json({ message: "Loại giảm giá không hợp lệ." });
    }

    if (Number.isNaN(numericValue) || numericValue <= 0) {
      return res.status(400).json({ message: "Giá trị giảm giá không hợp lệ." });
    }

    if (type === "percent" && numericValue > 100) {
      return res.status(400).json({ message: "Giảm giá theo % không được lớn hơn 100." });
    }

    if (Number.isNaN(numericMinOrderValue) || numericMinOrderValue < 0) {
      return res.status(400).json({ message: "Giá trị đơn hàng tối thiểu không hợp lệ." });
    }

    if (Number.isNaN(numericMaxDiscountValue) || numericMaxDiscountValue < 0) {
      return res.status(400).json({ message: "Mức giảm tối đa không hợp lệ." });
    }

    if (Number.isNaN(numericUsageLimit) || numericUsageLimit < 0) {
      return res.status(400).json({ message: "Số lượt sử dụng tối đa không hợp lệ." });
    }

    const hasStartDate = Boolean(startDate);
    const hasEndDate = Boolean(endDate);

    if (hasStartDate !== hasEndDate) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ cả ngày bắt đầu và ngày kết thúc." });
    }

    let start;
    let end;
    if (hasStartDate && hasEndDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return res.status(400).json({ message: "Khoảng thời gian áp dụng không hợp lệ." });
      }
    }

    const existedCode = await Discount.findOne({ code: normalizedCode, _id: { $ne: id } });
    if (existedCode) {
      return res.status(409).json({ message: "Mã giảm giá đã tồn tại." });
    }

    const updatedDiscount = await Discount.findByIdAndUpdate(
      id,
      {
        code: normalizedCode,
        type,
        value: numericValue,
        minOrderValue: numericMinOrderValue,
        maxDiscountValue: numericMaxDiscountValue,
        startDate: hasStartDate ? start : null,
        endDate: hasEndDate ? end : null,
        usageLimit: numericUsageLimit,
        isActive: Boolean(isActive),
      },
      { new: true, runValidators: true }
    );

    if (!updatedDiscount) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
    }

    logAdminAction({
      req,
      adminUser,
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
});

router.delete("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const deletedDiscount = await Discount.findByIdAndDelete(id);

    if (!deletedDiscount) {
      return res.status(404).json({ message: "Không tìm thấy mã giảm giá." });
    }

    logAdminAction({
      req,
      adminUser,
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
});

module.exports = router;
