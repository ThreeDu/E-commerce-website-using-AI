const { defineModel, NOW, EMPTY_OBJECT } = require("../db/model");

module.exports = defineModel("Category", {
  collection: "categories",
  defaults: { description: "", parentId: null },
  trim: ["name"],
  refs: { parentId: "Category" },
  unique: [["name", "parentId"]],
});
