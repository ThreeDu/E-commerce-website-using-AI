const Cart = require("../models/Cart");
const { verifyUserRequest } = require("../routes/helpers/authHelpers");

const getCart = async (req, res) => {
  const user = await verifyUserRequest(req, res);
  if (!user) {
    return;
  }

  try {
    const cart = await Cart.findOne({ user: user._id }).populate({
      path: "items.product",
      select: "name price discountPercent finalPrice image category brand series model variant sku stock averageRating",
    });

    if (!cart) {
      return res.json({ items: [] });
    }

    // Format items to match frontend expectation
    const formattedItems = cart.items
      .filter((item) => item.product) // Filter out deleted products
      .map((item) => {
        const productObj = item.product.toObject();
        return {
          ...productObj,
          id: productObj._id.toString(),
          quantity: item.quantity,
          selected: true,
        };
      });

    return res.json({ items: formattedItems });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

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
  getCart,
  syncCart,
};
