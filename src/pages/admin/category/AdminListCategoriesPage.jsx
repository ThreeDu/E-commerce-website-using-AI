import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import {
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from "../../../services/admin/categoryService";
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

  const loadCategories = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminCategories(auth.token);
      setCategories(data.categories || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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

    const sortByName = (list) =>
      [...list].sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }));

    const traverse = (nodes, depth) => {
      sortByName(nodes).forEach((node) => {
        result.push({ category: node, depth });
        const children = childrenByParentId.get(String(node._id)) || [];
        if (children.length > 0) {
          traverse(children, depth + 1);
        }
      });
    };

    const roots = childrenByParentId.get("root") || [];
    traverse(roots, 0);
    return result;
  }, [childrenByParentId]);

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
      setMessage(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCategory?.name?.trim()) {
      setMessage("Tên danh mục không được để trống.");
      return;
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
      setMessage(error.message);
    }
  };

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
                {flatCategoryTree.map(({ category, depth }) => {
                  const level = getCategoryLevel(category);
                  const isEditing = editingCategory?._id === category._id;
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
                          <span>
                            {depth > 0 ? "- " : ""}
                            {category.name}
                          </span>
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
