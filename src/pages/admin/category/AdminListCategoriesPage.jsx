import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import {
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from "../../../services/admin/categoryService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import "../../../css/admin/categories.css";

function AdminListCategoriesPage() {
  const location = useLocation();
  const { auth } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState(null);
  const [message, setMessage] = useState(location.state?.successMessage || "");
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(new Set());

  const loadCategories = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminCategories(auth.token);
      setCategories(data.categories || []);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể tải danh sách danh mục."));
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const parentIds = new Set(categories.filter((item) => item.parentId).map((item) => String(item.parentId)));
    setExpandedCategoryIds(parentIds);
  }, [categories]);

  const categoriesById = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => {
      map.set(String(item._id), item);
    });
    return map;
  }, [categories]);

  const getCategoryLevel = useCallback(
    (category) => {
      let depth = 0;
      let cursor = category;
      const visited = new Set();

      while (cursor?.parentId) {
        const parentId = String(cursor.parentId);
        if (visited.has(parentId)) {
          break;
        }

        visited.add(parentId);
        const parent = categoriesById.get(parentId);
        if (!parent) {
          break;
        }

        depth += 1;
        cursor = parent;
      }

      return depth;
    },
    [categoriesById]
  );

  const getCategoryPath = useCallback(
    (category) => {
      const path = [category.name];
      let cursor = category;
      const visited = new Set();

      while (cursor?.parentId) {
        const parentId = String(cursor.parentId);
        if (visited.has(parentId)) {
          break;
        }

        visited.add(parentId);
        const parent = categoriesById.get(parentId);
        if (!parent) {
          break;
        }

        path.unshift(parent.name);
        cursor = parent;
      }

      return path.join(" > ");
    },
    [categoriesById]
  );

  const childrenByParentId = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => {
      const parentKey = item.parentId ? String(item.parentId) : "root";
      const existing = map.get(parentKey) || [];
      existing.push(item);
      map.set(parentKey, existing);
    });
    return map;
  }, [categories]);

  const flatCategoryTree = useMemo(() => {
    const result = [];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const isSearching = normalizedSearch.length > 0;

    const sortByName = (list) =>
      [...list].sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));

    const traverse = (nodes, depth) => {
      sortByName(nodes).forEach((node) => {
        const children = childrenByParentId.get(String(node._id)) || [];
        const hasChildren = children.length > 0;

        result.push({ category: node, depth, hasChildren });

        if (hasChildren && (isSearching || expandedCategoryIds.has(String(node._id)))) {
          traverse(children, depth + 1);
        }
      });
    };

    const roots = childrenByParentId.get("root") || [];
    traverse(roots, 0);

    if (!isSearching) {
      return result;
    }

    return result.filter(({ category }) => {
      const name = String(category.name || "").toLowerCase();
      const path = getCategoryPath(category).toLowerCase();
      return name.includes(normalizedSearch) || path.includes(normalizedSearch);
    });
  }, [childrenByParentId, expandedCategoryIds, searchTerm, getCategoryPath]);

  const parentOptionsForEdit = useMemo(() => {
    if (!editingCategory?._id) {
      return categories;
    }

    const currentId = String(editingCategory._id);
    const blocked = new Set([currentId]);

    const queue = [currentId];
    while (queue.length > 0) {
      const parentId = queue.shift();
      categories.forEach((item) => {
        if (String(item.parentId) === String(parentId) && !blocked.has(String(item._id))) {
          blocked.add(String(item._id));
          queue.push(String(item._id));
        }
      });
    }

    return categories.filter((item) => !blocked.has(String(item._id)));
  }, [categories, editingCategory]);

  const levelLabel = (level) => {
    if (level === 0) {
      return "Cấp 1";
    }
    if (level === 1) {
      return "Cấp 2";
    }
    return "Cấp 3";
  };

  const handleDelete = async () => {
    if (!categoryPendingDelete?._id) {
      return;
    }

    try {
      setDeleting(true);
      setMessage("");
      await deleteAdminCategory(auth.token, categoryPendingDelete._id);
      setMessage("Xóa danh mục thành công.");
      setCategoryPendingDelete(null);
      await loadCategories();
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể xóa danh mục."));
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (categoryId) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev);
      const key = String(categoryId);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCategory?.name?.trim()) {
      setMessage("Tên danh mục không được để trống.");
      return;
    }

    const hasParentChanged =
      String(editingCategory.parentId || "") !== String(editingCategory.originalParentId || "");

    if (hasParentChanged) {
      const isConfirmed = window.confirm(
        "Bạn đang thay đổi danh mục cha. Thao tác này có thể ảnh hưởng cấu trúc hiển thị danh mục con. Tiếp tục?"
      );

      if (!isConfirmed) {
        return;
      }
    }

    try {
      setMessage("");
      await updateAdminCategory(auth.token, editingCategory._id, {
        name: editingCategory.name.trim(),
        parentId: editingCategory.parentId || null,
      });
      setEditingCategory(null);
      setMessage("Cập nhật danh mục thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật danh mục."));
    }
  };

  const hasParentChanged =
    editingCategory && String(editingCategory.parentId || "") !== String(editingCategory.originalParentId || "");

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Quản lý danh mục</h2>
        <p>
          Danh sách hiển thị theo cấu trúc cha-con: cấp 1 (danh mục chính), cấp 2 và cấp 3 tương
          ứng.
        </p>
        {message && <p className="form-message">{message}</p>}

        <div className="admin-page-toolbar">
          <Link to="/admin/categories/add" className="primary-link-btn">
            Thêm danh mục mới
          </Link>
        </div>

        <div className="category-search-row">
          <label htmlFor="category-search">Tìm kiếm danh mục</label>
          <input
            id="category-search"
            type="text"
            placeholder="Nhập tên hoặc đường dẫn danh mục..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        {hasParentChanged && (
          <p className="category-change-warning">
            Bạn đang đổi danh mục cha. Vui lòng kiểm tra kỹ trước khi lưu để tránh ảnh hưởng cấu trúc cây.
          </p>
        )}

        {loading ? (
          <p>Đang tải danh sách danh mục...</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Tên danh mục</th>
                  <th>Cấp</th>
                  <th>Danh mục cha</th>
                  <th>Đường dẫn</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {flatCategoryTree.map(({ category, depth, hasChildren }) => {
                  const level = getCategoryLevel(category);
                  const isEditing = editingCategory?._id === category._id;
                  const isExpanded = expandedCategoryIds.has(String(category._id));
                  const parentName = category.parentId
                    ? categoriesById.get(String(category.parentId))?.name || "Không rõ"
                    : "-";

                  return (
                    <tr key={category._id}>
                      <td className="category-name-cell" style={{ paddingLeft: `${12 + depth * 26}px` }}>
                        {isEditing ? (
                          <input
                            className="table-input"
                            value={editingCategory.name}
                            onChange={(event) =>
                              setEditingCategory((prev) => ({ ...prev, name: event.target.value }))
                            }
                          />
                        ) : (
                          <div className="category-name-wrap">
                            {hasChildren ? (
                              <button
                                type="button"
                                className="category-expand-btn"
                                onClick={() => toggleExpand(category._id)}
                                aria-label={isExpanded ? "Thu gọn danh mục" : "Mở rộng danh mục"}
                              >
                                {isExpanded ? "▾" : "▸"}
                              </button>
                            ) : (
                              <span className="category-expand-placeholder" aria-hidden="true">
                                •
                              </span>
                            )}
                            <span>
                              {depth > 0 ? "- " : ""}
                              {category.name}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`category-level-badge level-${level + 1}`}>
                          {levelLabel(level)}
                        </span>
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="table-select"
                            value={editingCategory.parentId || ""}
                            onChange={(event) =>
                              setEditingCategory((prev) => ({
                                ...prev,
                                parentId: event.target.value || null,
                              }))
                            }
                          >
                            <option value="">Không có (danh mục cấp 1)</option>
                            {parentOptionsForEdit.map((item) => (
                              <option key={item._id} value={item._id}>
                                {getCategoryPath(item)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          parentName
                        )}
                      </td>
                      <td className="category-path-cell">{getCategoryPath(category)}</td>
                      <td>
                        <div className="table-actions">
                          {isEditing ? (
                            <>
                              <button type="button" onClick={handleSaveEdit}>
                                Lưu
                              </button>
                              <button type="button" onClick={() => setEditingCategory(null)}>
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingCategory({
                                    _id: category._id,
                                    name: category.name,
                                    parentId: category.parentId || null,
                                    originalParentId: category.parentId || null,
                                  })
                                }
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className="danger-btn"
                                onClick={() => setCategoryPendingDelete(category)}
                              >
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {flatCategoryTree.length === 0 && (
                  <tr>
                    <td colSpan="5" className="table-empty-cell">
                      Không tìm thấy danh mục phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {categoryPendingDelete && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">Xác nhận xóa danh mục</h3>
            <p>
              Bạn có chắc chắn muốn xóa danh mục <strong>{categoryPendingDelete.name}</strong>?
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setCategoryPendingDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button type="button" className="danger-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminListCategoriesPage;
