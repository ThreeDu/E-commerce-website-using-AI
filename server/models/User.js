const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("User", {
  collection: "users",
  defaults: { role: "user", phone: "", address: "", wishlist: [], avatar: "", loyaltyPoints: 0 },
  lower: ["email"],
  trim: ["name", "email", "phone", "address", "avatar"],
  arrays: ["wishlist"],
  refs: { wishlist: "Product" },
  unique: [["email"]],
});
