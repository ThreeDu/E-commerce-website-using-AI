const express = require("express");
const Category = require("../models/Category");
const { verifyAdminRequest } = require("./helpers/authHelpers");

const router = express.Router();

router.get("/", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách danh mục thành công.",
      categories,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { name, parentId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tên danh mục là bắt buộc." });
    }

    let normalizedParentId = null;
    if (parentId) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return res.status(404).json({ message: "Không tìm thấy danh mục chính." });
      }

      if (parentCategory.parentId) {
        return res.status(400).json({ message: "Chỉ hỗ trợ tối đa 2 cấp danh mục." });
      }

      normalizedParentId = parentCategory._id;
    }

    const existedCategory = await Category.findOne({
      name: String(name).trim(),
      parentId: normalizedParentId,
    });
    if (existedCategory) {
      return res.status(409).json({ message: "Danh mục đã tồn tại ở cấp này." });
    }

    const category = await Category.create({
      name: String(name).trim(),
      parentId: normalizedParentId,
    });

    return res.status(201).json({
      message: "Thêm danh mục thành công.",
      category,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const { name, parentId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tên danh mục là bắt buộc." });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục." });
    }

    let normalizedParentId = null;
    if (parentId) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        return res.status(404).json({ message: "Không tìm thấy danh mục chính." });
      }

      if (String(parentCategory._id) === String(id)) {
        return res.status(400).json({ message: "Danh mục không thể là cha của chính nó." });
      }

      if (parentCategory.parentId) {
        return res.status(400).json({ message: "Chỉ hỗ trợ tối đa 2 cấp danh mục." });
      }

      normalizedParentId = parentCategory._id;
    }

    const existedCategory = await Category.findOne({
      _id: { $ne: id },
      name: String(name).trim(),
      parentId: normalizedParentId,
    });
    if (existedCategory) {
      return res.status(409).json({ message: "Danh mục đã tồn tại ở cấp này." });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      {
        name: String(name).trim(),
        parentId: normalizedParentId,
      },
      { new: true, runValidators: true }
    );

    return res.json({
      message: "Cập nhật danh mục thành công.",
      category: updatedCategory,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  const adminUser = await verifyAdminRequest(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục." });
    }

    const hasChildren = await Category.exists({ parentId: category._id });
    if (hasChildren) {
      return res.status(400).json({
        message: "Danh mục chính đang có danh mục phụ. Vui lòng xóa danh mục phụ trước.",
      });
    }

    await Category.findByIdAndDelete(id);

    return res.json({
      message: "Xóa danh mục thành công.",
      category,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
