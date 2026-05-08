const Order = require("../models/Order");
const Discount = require("../models/Discount");
const Product = require("../models/Product");
const { verifyUserRequest } = require("../routes/helpers/authHelpers");

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

function calculateSubtotal(orderItems) {
  return orderItems.reduce((sum, item) => {
    const quantity = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    if (Number.isNaN(quantity) || Number.isNaN(price) || quantity <= 0 || price < 0) {
      return sum;
    }
    return sum + quantity * price;
  }, 0);
}

function calculateDiscountAmount(discount, subtotalPrice) {
  if (!discount || subtotalPrice <= 0) {
    return 0;
  }

  let amount = 0;
  if (discount.type === "percent") {
    amount = Math.floor((subtotalPrice * Number(discount.value || 0)) / 100);
  } else {
    amount = Math.floor(Number(discount.value || 0));
  }

  const maxDiscount = Number(discount.maxDiscountValue || 0);
  if (maxDiscount > 0) {
    amount = Math.min(amount, maxDiscount);
  }

  amount = Math.max(0, amount);
  return Math.min(amount, subtotalPrice);
}

async function validateDiscount(discount, subtotalPrice, authUser) {
  if (!discount) {
    return "Mã giảm giá không tồn tại.";
  }

  if (!discount.isActive) {
    return "Mã giảm giá đang không hoạt động.";
  }

  const now = new Date();
  if (discount.startDate && now < discount.startDate) {
    return "Mã giảm giá chưa đến thời gian áp dụng.";
  }

  if (discount.endDate && now > discount.endDate) {
    return "Mã giảm giá đã hết hạn.";
  }

  if (
    Number(discount.usageLimit || 0) > 0 &&
    Number(discount.usedCount || 0) >= Number(discount.usageLimit || 0)
  ) {
    return "Mã giảm giá đã hết lượt sử dụng (đạt giới hạn tổng).";
  }

  // Kiểm tra người dùng chỉ định
  if (discount.allowedUsers && discount.allowedUsers.length > 0) {
    const isAllowed = discount.allowedUsers.some(
      (userId) => String(userId) === String(authUser._id)
    );
    if (!isAllowed) {
      return "Mã giảm giá này không dành cho tài khoản của bạn.";
    }
  }

  // Kiểm tra giới hạn số lần dùng trên mỗi user
  if (Number(discount.usageLimitPerUser || 0) > 0) {
    // Đếm số đơn hàng đã đặt dùng mã này (không tính đơn đã bị hủy)
    const usageCount = await Order.countDocuments({
      user: authUser._id,
      discount: discount._id,
      status: { $ne: "cancelled" },
    });

    if (usageCount >= Number(discount.usageLimitPerUser)) {
      return "Bạn đã hết lượt sử dụng mã giảm giá này.";
    }
  }

  if (subtotalPrice < Number(discount.minOrderValue || 0)) {
    return `Đơn hàng cần tối thiểu ${Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ để áp dụng mã này.`;
  }

  return "";
}

const verifyCoupon = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const code = String(req.params.code || "").trim().toUpperCase();
    const subtotalPrice = Math.max(0, Number(req.query.subtotal || 0));

    if (!code) {
      return res.status(400).json({ message: "Thiếu mã giảm giá." });
    }

    const discount = await Discount.findOne({ code });
    const invalidReason = await validateDiscount(discount, subtotalPrice, authUser);
    if (invalidReason) {
      return res.status(400).json({ message: invalidReason });
    }

    const discountAmount = calculateDiscountAmount(discount, subtotalPrice);

    return res.json({
      message: "Áp dụng mã giảm giá thành công.",
      coupon: {
        id: discount._id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
      },
      subtotalPrice,
      discountAmount,
      totalPrice: Math.max(0, subtotalPrice - discountAmount),
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi kiểm tra mã giảm giá" });
  }
};

const createOrder = async (req, res) => {
  const decrementedStocks = [];

  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const { orderItems, shippingAddress, paymentMethod, discountCode } = req.body;

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ message: "Không có sản phẩm nào trong đơn hàng" });
    }

    const subtotalPrice = calculateSubtotal(orderItems);
    if (subtotalPrice <= 0) {
      return res.status(400).json({ message: "Dữ liệu đơn hàng không hợp lệ." });
    }

    // Gộp số lượng theo từng sản phẩm để tránh trừ kho sai khi cùng sản phẩm xuất hiện nhiều lần.
    const quantityByProductId = new Map();
    for (const item of orderItems) {
      const productId = String(item?.product || "").trim();
      const quantity = Number(item?.quantity || 0);

      if (!productId || Number.isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ message: "Sản phẩm trong đơn hàng không hợp lệ." });
      }

      quantityByProductId.set(productId, Number(quantityByProductId.get(productId) || 0) + quantity);
    }

    const productIds = Array.from(quantityByProductId.keys());
    const existingProducts = await Product.find({ _id: { $in: productIds } }).select("_id name stock").lean();
    const existingProductMap = new Map(existingProducts.map((product) => [String(product._id), product]));

    for (const [productId, quantity] of quantityByProductId.entries()) {
      const product = existingProductMap.get(productId);
      if (!product) {
        return res.status(400).json({ message: "Có sản phẩm không còn tồn tại." });
      }

      if (Number(product.stock || 0) < quantity) {
        return res.status(400).json({
          message: `Sản phẩm \"${product.name}\" chỉ còn ${Number(product.stock || 0)} trong kho, không đủ số lượng đặt.`,
        });
      }
    }

    for (const [productId, quantity] of quantityByProductId.entries()) {
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
          stock: { $gte: quantity },
        },
        {
          $inc: { stock: -quantity },
        },
        {
          new: true,
        }
      );

      if (!updatedProduct) {
        if (decrementedStocks.length > 0) {
          await Promise.all(
            decrementedStocks.map((entry) =>
              Product.updateOne({ _id: entry.productId }, { $inc: { stock: entry.quantity } })
            )
          );
        }

        return res.status(400).json({ message: "Tồn kho vừa thay đổi, vui lòng thử đặt lại đơn hàng." });
      }

      decrementedStocks.push({ productId, quantity });
    }

    let appliedDiscount = null;
    let appliedDiscountCode = "";
    let discountAmount = 0;

    if (String(discountCode || "").trim()) {
      const normalizedCode = String(discountCode).trim().toUpperCase();
      const discount = await Discount.findOne({ code: normalizedCode });
      const invalidReason = await validateDiscount(discount, subtotalPrice, authUser);

      if (invalidReason) {
        return res.status(400).json({ message: invalidReason });
      }

      appliedDiscount = discount;
      appliedDiscountCode = discount.code;
      discountAmount = calculateDiscountAmount(discount, subtotalPrice);
    }

    const totalPrice = Math.max(0, subtotalPrice - discountAmount);

    const order = new Order({
      user: authUser._id,
      orderItems,
      shippingAddress,
      paymentMethod,
      subtotalPrice,
      discountCode: appliedDiscountCode,
      discountAmount,
      discount: appliedDiscount?._id || null,
      totalPrice,
    });

    const createdOrder = await order.save();

    if (appliedDiscount) {
      await Discount.findByIdAndUpdate(appliedDiscount._id, { $inc: { usedCount: 1 } });
    }

    return res.status(201).json({ message: "Đặt hàng thành công", order: createdOrder });
  } catch (error) {
    if (decrementedStocks.length > 0) {
      try {
        await Promise.all(
          decrementedStocks.map((entry) =>
            Product.updateOne({ _id: entry.productId }, { $inc: { stock: entry.quantity } })
          )
        );
      } catch (rollbackError) {
        console.error("Lỗi khi hoàn kho sau thất bại tạo đơn hàng:", rollbackError);
      }
    }

    console.error("Lỗi khi tạo đơn hàng:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi tạo đơn hàng" });
  }
};

const listMyOrders = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const orders = await Order.find({ user: authUser._id }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy lịch sử đơn hàng" });
  }
};

const getMyOrderById = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: authUser._id,
    }).populate("orderItems.product", "_id name image");

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy chi tiết đơn hàng" });
  }
};

const cancelMyOrder = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const cancelledReason = String(req.body?.reason || "").trim();
    if (cancelledReason.length < 5) {
      return res.status(400).json({ message: "Vui lòng nhập lý do hủy đơn tối thiểu 5 ký tự." });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: authUser._id,
    });

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    if (!CANCELLABLE_STATUSES.has(order.status)) {
      return res.status(400).json({ message: "Đơn hàng đã xử lý, không thể hủy." });
    }

    order.status = "cancelled";
    order.isDelivered = false;
    order.cancelledReason = cancelledReason;
    order.cancelledAt = new Date();
    await order.save();

    return res.json({
      message: "Hủy đơn hàng thành công.",
      order,
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi hủy đơn hàng" });
  }
};

const listMyVouchers = async (req, res) => {
  try {
    const authUser = await verifyUserRequest(req, res);
    if (!authUser) {
      return;
    }

    const now = new Date();
    
    // 1. Fetch all active discounts that apply to current user
    const discounts = await Discount.find({
      isActive: true,
      $or: [
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: null, endDate: null },
        { startDate: { $lte: now }, endDate: null },
        { startDate: null, endDate: { $gte: now } },
      ],
      $or: [
        { allowedUsers: { $size: 0 } }, // Vouchers for everyone
        { allowedUsers: authUser._id }  // Vouchers assigned to this user
      ]
    }).sort({ createdAt: -1 });

    const availableVouchers = [];

    // 2. Filter out discounts that reached usage limits
    for (const discount of discounts) {
      // Check total usage limit
      if (
        Number(discount.usageLimit || 0) > 0 &&
        Number(discount.usedCount || 0) >= Number(discount.usageLimit)
      ) {
        continue;
      }

      // Check per-user usage limit
      if (Number(discount.usageLimitPerUser || 0) > 0) {
        const usageCount = await Order.countDocuments({
          user: authUser._id,
          discount: discount._id,
          status: { $ne: "cancelled" },
        });

        if (usageCount >= Number(discount.usageLimitPerUser)) {
          continue;
        }
      }

      availableVouchers.push({
        id: discount._id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        minOrderValue: discount.minOrderValue,
        maxDiscountValue: discount.maxDiscountValue,
        endDate: discount.endDate,
      });
    }

    return res.json({ vouchers: availableVouchers });
  } catch (error) {
    console.error("Error listing vouchers:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh sách voucher." });
  }
};

module.exports = {
  verifyCoupon,
  createOrder,
  listMyOrders,
  listMyVouchers,
  getMyOrderById,
  cancelMyOrder,
};
