const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên danh mục là bắt buộc"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ name: 1, parentId: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);