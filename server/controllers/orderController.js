const Order = require("../models/Order");
const Discount = require("../models/Discount");
const Product = require("../models/Product");
const { changeOrderStatus } = require("../services/orderStatusService");
const { buildPaymentConfig } = require("../helpers/paymentHelper");
const {
  getUnitPrice,
  calculateSubtotal,
  restockItems,
  calculateDiscountAmount,
  validateDiscount,
} = require("../services/orderService");

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

const verifyCoupon = async (req, res) => {
  try {
    const authUser = req.user;

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
  let reservedDiscountId = null;

  try {
    const authUser = req.user;

    const { orderItems, shippingAddress, paymentMethod, discountCode } = req.body;

    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ message: "Không có sản phẩm nào trong đơn hàng" });
    }

    // Gộp số lượng theo từng sản phẩm để tránh trừ kho sai khi cùng sản phẩm xuất hiện nhiều lần.
    const quantityByProductId = new Map();
    for (const item of orderItems) {
      const productId = String(item?.product || "").trim();
      const quantity = Number(item?.quantity || 0);

      if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ message: "Sản phẩm trong đơn hàng không hợp lệ." });
      }

      quantityByProductId.set(productId, Number(quantityByProductId.get(productId) || 0) + quantity);
    }

    const productIds = Array.from(quantityByProductId.keys());
    const existingProducts = await Product.find({ _id: { $in: productIds } })
      .select("_id name stock price finalPrice discountPercent")
      .lean();
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

    const pricedOrderItems = Array.from(quantityByProductId, ([productId, quantity]) => {
      const product = existingProductMap.get(productId);
      return { product: product._id, name: product.name, quantity, price: getUnitPrice(product) };
    });

    const subtotalPrice = calculateSubtotal(pricedOrderItems);
    if (subtotalPrice <= 0) {
      return res.status(400).json({ message: "Dữ liệu đơn hàng không hợp lệ." });
    }

    let appliedDiscount = null;
    let discountAmount = 0;

    if (String(discountCode || "").trim()) {
      const normalizedCode = String(discountCode).trim().toUpperCase();
      const discount = await Discount.findOne({ code: normalizedCode });
      const invalidReason = await validateDiscount(discount, subtotalPrice, authUser);

      if (invalidReason) {
        return res.status(400).json({ message: invalidReason });
      }

      // Giữ lượt dùng nguyên tử để hai đơn song song không vượt usageLimit.
      const reserved = await Discount.findOneAndUpdate(
        {
          _id: discount._id,
          $or: [
            { usageLimit: { $in: [null, 0] } },
            { $expr: { $lt: [{ $ifNull: ["$usedCount", 0] }, "$usageLimit"] } },
          ],
        },
        { $inc: { usedCount: 1 } }
      );
      if (!reserved) {
        return res.status(400).json({ message: "Mã giảm giá đã hết lượt sử dụng (đạt giới hạn tổng)." });
      }

      reservedDiscountId = discount._id;
      appliedDiscount = discount;
      discountAmount = calculateDiscountAmount(discount, subtotalPrice);
    }

    for (const [productId, quantity] of quantityByProductId.entries()) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        throw Object.assign(new Error("STOCK_CHANGED"), { status: 400 });
      }

      decrementedStocks.push({ productId, quantity });
    }

    const order = new Order({
      user: authUser._id,
      orderItems: pricedOrderItems,
      shippingAddress,
      paymentMethod,
      subtotalPrice,
      discountCode: appliedDiscount?.code || "",
      discountAmount,
      discount: appliedDiscount?._id || null,
      totalPrice: Math.max(0, subtotalPrice - discountAmount),
    });

    const createdOrder = await order.save();

    return res.status(201).json({ message: "Đặt hàng thành công", order: createdOrder });
  } catch (error) {
    try {
      await restockItems(decrementedStocks);
      if (reservedDiscountId) {
        await Discount.updateOne({ _id: reservedDiscountId }, { $inc: { usedCount: -1 } });
      }
    } catch (rollbackError) {
      console.error("Lỗi khi hoàn kho sau thất bại tạo đơn hàng:", rollbackError);
    }

    if (error.message === "STOCK_CHANGED") {
      return res.status(400).json({ message: "Tồn kho vừa thay đổi, vui lòng thử đặt lại đơn hàng." });
    }

    console.error("Lỗi khi tạo đơn hàng:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi tạo đơn hàng" });
  }
};

const listMyOrders = async (req, res) => {
  try {
    const authUser = req.user;

    const orders = await Order.find({ user: authUser._id }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy lịch sử đơn hàng" });
  }
};

const getMyOrderById = async (req, res) => {
  try {
    const authUser = req.user;

    const order = await Order.findOne({
      _id: req.params.id,
      user: authUser._id,
    }).populate("orderItems.product", "_id name image");

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }

    const orderObj = order.toObject();
    const paymentConfig = buildPaymentConfig(orderObj);
    if (paymentConfig) {
      orderObj.paymentConfig = paymentConfig;
    }

    return res.json(orderObj);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy chi tiết đơn hàng" });
  }
};

const cancelMyOrder = async (req, res) => {
  try {
    const authUser = req.user;

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

    const { order: cancelledOrder } = await changeOrderStatus(order._id, "cancelled", { reason: cancelledReason });

    return res.json({
      message: "Hủy đơn hàng thành công.",
      order: cancelledOrder,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: "Lỗi máy chủ khi hủy đơn hàng" });
  }
};

const listMyVouchers = async (req, res) => {
  try {
    const authUser = req.user;

    const now = new Date();
    
    // 1. Fetch all active discounts that apply to current user
    const discounts = await Discount.find({
      isActive: true,
      $and: [
        {
          $or: [
            { startDate: { $lte: now }, endDate: { $gte: now } },
            { startDate: null, endDate: null },
            { startDate: { $lte: now }, endDate: null },
            { startDate: null, endDate: { $gte: now } },
          ]
        },
        {
          $or: [
            { allowedUsers: { $size: 0 } }, // Vouchers for everyone
            { allowedUsers: authUser._id }  // Vouchers assigned to this user
          ]
        }
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
