const Category = require("../models/Category");

const listCategories = async (req, res) => {
  try {
    const categories = await Category.find({});
    return res.json(categories);
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh mục" });
  }
};

module.exports = {
  listCategories,
};
