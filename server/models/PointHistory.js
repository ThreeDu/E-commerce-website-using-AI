const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("PointHistory", {
  collection: "pointhistories",
  defaults: { relatedOrder: null, relatedDiscount: null },
  trim: ["reason"],
  refs: { user: "User", relatedOrder: "Order", relatedDiscount: "Discount" },
});
