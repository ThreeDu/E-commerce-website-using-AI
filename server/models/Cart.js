const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("Cart", {
  collection: "carts",
  subdocArrays: ["items"],
  arrays: ["items"],
  subDefaults: { items: { quantity: 1 } },
  refs: { user: "User", "items.product": "Product" },
  unique: [["user"]],
});
