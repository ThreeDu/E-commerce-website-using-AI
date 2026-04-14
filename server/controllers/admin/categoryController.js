const Category = require("../../models/Category");
const { logAdminAction } = require("../../utils/adminAuditLogger");

const validateParentForThreeLevels = async (parentId, currentCategoryId = null) => {
  const parentCategory = await Category.findById(parentId).select("_id parentId");
  if (!parentCategory) {
    return { errorStatus: 404, errorMessage: "Không tìm thấy danh mục cha." };
  }

  let depthFromRoot = 0;
  let cursor = parentCategory;
  const visited = new Set();

  while (cursor) {
    const cursorId = String(cursor._id);
    if (visited.has(cursorId)) {
      return { errorStatus: 400, errorMessage: "Cấu trúc danh mục không hợp lệ." };
    }
    visited.add(cursorId);

    if (currentCategoryId && cursorId === String(currentCategoryId)) {
      return { errorStatus: 400, errorMessage: "Không thể chọn danh mục con làm danh mục cha." };
    }

    if (!cursor.parentId) {
      break;
    }

    depthFromRoot += 1;
    cursor = await Category.findById(cursor.parentId).select("_id parentId");
  }

  if (depthFromRoot >= 2) {
    return { errorStatus: 400, errorMessage: "Chỉ hỗ trợ tối đa 3 cấp danh mục." };
  }

  return { parentCategory };
};

const listCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });

    return res.json({
      message: "Lấy danh sách danh mục thành công.",
      categories,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, parentId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tên danh mục là bắt buộc." });
    }

    let normalizedParentId = null;
    if (parentId) {
      const parentValidation = await validateParentForThreeLevels(parentId);
      if (parentValidation.errorStatus) {
        return res
          .status(parentValidation.errorStatus)
          .json({ message: parentValidation.errorMessage });
      }

      normalizedParentId = parentValidation.parentCategory._id;
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

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "create",
      resource: "category",
      resourceId: category._id,
      details: {
        name: category.name,
        parentId: category.parentId ? String(category.parentId) : null,
      },
    });

    return res.status(201).json({
      message: "Thêm danh mục thành công.",
      category,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateCategory = async (req, res) => {
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
      const parentValidation = await validateParentForThreeLevels(parentId, id);
      if (parentValidation.errorStatus) {
        return res
          .status(parentValidation.errorStatus)
          .json({ message: parentValidation.errorMessage });
      }

      normalizedParentId = parentValidation.parentCategory._id;
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

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "update",
      resource: "category",
      resourceId: updatedCategory._id,
      details: {
        name: updatedCategory.name,
        parentId: updatedCategory.parentId ? String(updatedCategory.parentId) : null,
      },
    });

    return res.json({
      message: "Cập nhật danh mục thành công.",
      category: updatedCategory,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục." });
    }

    const hasChildren = await Category.exists({ parentId: category._id });
    if (hasChildren) {
      return res.status(400).json({
        message: "Danh mục đang có danh mục con. Vui lòng xóa danh mục con trước.",
      });
    }

    await Category.findByIdAndDelete(id);

    logAdminAction({
      req,
      adminUser: req.adminUser,
      action: "delete",
      resource: "category",
      resourceId: category._id,
      details: {
        name: category.name,
        parentId: category.parentId ? String(category.parentId) : null,
      },
    });

    return res.json({
      message: "Xóa danh mục thành công.",
      category,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
