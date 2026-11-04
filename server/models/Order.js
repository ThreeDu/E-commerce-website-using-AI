const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("Order", {
  collection: "orders",
  defaults: {
    paymentMethod: "cod", totalPrice: 0, subtotalPrice: 0, discountCode: "", discountAmount: 0,
    discount: null, status: "pending", isDelivered: false, deliveredAt: null, isPaid: false, paidAt: null,
    "paymentDetails.transactionRef": "", "paymentDetails.bankCode": "", "paymentDetails.amount": 0,
    "paymentDetails.counterpartName": "", cancelledReason: "", cancelledAt: null,
  },
  trim: ["discountCode", "cancelledReason"],
  subdocArrays: ["orderItems"],
  arrays: ["orderItems"],
  refs: { user: "User", discount: "Discount", "orderItems.product": "Product" },
});
