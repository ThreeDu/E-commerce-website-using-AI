const Cart = require("../models/Cart");
const { verifyUserRequest } = require("../routes/helpers/authHelpers");

const syncCart = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) {
    return;
  }

  try {
    const { items } = req.body;

    const cartItems = (items || []).map((item) => ({
      product: item.productId || item.product,
      quantity: Number(item.quantity) || 1,
    }));

    await Cart.findOneAndUpdate(
      { user: user._id },
      { items: cartItems, updatedAt: Date.now() },
      { upsert: true, new: true }
    );

    return res.json({
      message: "Đồng bộ giỏ hàng thành công.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  syncCart,
};
