import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useNotification } from "../../../context/NotificationContext";
import {
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from "../../../services/admin/categoryService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPen,
  faTrash,
  faCheck,
  faXmark,
  faChevronDown,
  faChevronRight,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
function AdminListCategoriesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { auth } = useAuth();
  const { success, error: notifyError } = useNotification();
  const consumedSuccessStateRef = useRef(new Set());
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [categoryPendingDelete, setCategoryPendingDelete] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(new Set());

  useEffect(() => {
    const successMessage = location.state?.successMessage;
    if (!successMessage) {
      return;
    }

    const stateKey = `${location.key || "no-key"}::${successMessage}`;
    if (consumedSuccessStateRef.current.has(stateKey)) {
      return;
    }

    consumedSuccessStateRef.current.add(stateKey);

    success(successMessage, { title: "Danh mục" });

    // Consume one-time router state to avoid duplicate toasts on re-render/remount.
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.key, location.pathname, location.state, navigate, success]);

  const loadCategories = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminCategories(auth.token);
      setCategories(data.categories || []);
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể tải danh sách danh mục."), { title: "Danh mục" });
    } finally {
      setLoading(false);
    }
  }, [auth?.token, notifyError]);

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
      await deleteAdminCategory(auth.token, categoryPendingDelete._id);
      success("Xóa danh mục thành công.", { title: "Danh mục" });
      setCategoryPendingDelete(null);
      await loadCategories();
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể xóa danh mục."), { title: "Danh mục" });
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
      notifyError("Tên danh mục không được để trống.", { title: "Danh mục" });
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
      await updateAdminCategory(auth.token, editingCategory._id, {
        name: editingCategory.name.trim(),
        parentId: editingCategory.parentId || null,
      });
      setEditingCategory(null);
      success("Cập nhật danh mục thành công.", { title: "Danh mục" });
      await loadCategories();
    } catch (error) {
      notifyError(getErrorMessage(error, "Không thể cập nhật danh mục."), { title: "Danh mục" });
    }
  };

  const hasParentChanged =
    editingCategory && String(editingCategory.parentId || "") !== String(editingCategory.originalParentId || "");

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="relative border border-admin-line rounded-[24px] p-8 shadow-admin bg-gradient-to-br from-white to-[#f8fbff] animate-admin-rise" aria-busy={loading || deleting}>
        <h2 className="text-[25px] font-bold tracking-tight text-admin-ink mt-0 mb-1 flex items-center">
          <FontAwesomeIcon icon={faFolderOpen} className="mr-2.5 text-admin-primary" />
          Quản lý danh mục
        </h2>
        <p className="text-sm text-admin-muted mt-2 mb-0 max-w-[760px] leading-relaxed">
          Danh sách hiển thị theo cấu trúc cha-con: cấp 1 (danh mục chính), cấp 2 và cấp 3 tương
          ứng.
        </p>

        <div className="mt-3 mb-4">
          <Link to="/admin/categories/add" className="inline-flex items-center justify-center bg-gradient-to-r from-admin-primary to-[#0f314f] text-white py-2.5 px-3.5 rounded-xl font-semibold shadow-md transition-all duration-150 hover:-translate-y-px hover:shadow-lg hover:opacity-95">
            <FontAwesomeIcon icon={faPlus} className="mr-1.5" />
            Thêm danh mục mới
          </Link>
        </div>

        <div className="grid gap-1.5 mt-2 mb-3.5 max-w-[440px]">
          <label htmlFor="category-search" className="text-xs uppercase tracking-wider text-[#6b7a8d] font-bold">Tìm kiếm danh mục</label>
          <input
            id="category-search"
            type="text"
            className="h-10 rounded-[10px] border border-[#d7e1ed] px-3 bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
            placeholder="Nhập tên hoặc đường dẫn danh mục..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        {hasParentChanged && (
          <p className="mb-3 p-[10px_12px] rounded-[10px] border border-[#ffd8a8] bg-[#fff7e8] text-[#8a4b00] text-sm font-semibold">
            Bạn đang đổi danh mục cha. Vui lòng kiểm tra kỹ trước khi lưu để tránh ảnh hưởng cấu trúc cây.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-admin-muted py-4">Đang tải danh sách danh mục...</p>
        ) : (
          <div className="mt-4 overflow-x-auto border border-[#dde7f3] rounded-[14px] bg-white">
            <table className="w-full border-collapse bg-white text-left">
              <thead>
                <tr className="border-b border-[#e6edf5]">
                  <th className="bg-[#f2f7ff] text-[#4a5c75] p-3 text-xs font-bold uppercase tracking-wider">Tên danh mục</th>
                  <th className="bg-[#f2f7ff] text-[#4a5c75] p-3 text-xs font-bold uppercase tracking-wider">Cấp</th>
                  <th className="bg-[#f2f7ff] text-[#4a5c75] p-3 text-xs font-bold uppercase tracking-wider">Danh mục cha</th>
                  <th className="bg-[#f2f7ff] text-[#4a5c75] p-3 text-xs font-bold uppercase tracking-wider">Đường dẫn</th>
                  <th className="bg-[#f2f7ff] text-[#4a5c75] p-3 text-xs font-bold uppercase tracking-wider">Thao tác</th>
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
                    <tr key={category._id} className="border-b border-[#e6edf5] transition-colors duration-150 hover:bg-[#f8fbff]">
                      <td className="p-3 font-semibold whitespace-nowrap" style={{ paddingLeft: `${12 + depth * 26}px` }}>
                        {isEditing ? (
                          <input
                            className="w-full p-2 border border-[#c7d3e0] rounded-lg focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] bg-white"
                            value={editingCategory.name}
                            onChange={(event) =>
                              setEditingCategory((prev) => ({ ...prev, name: event.target.value }))
                            }
                          />
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            {hasChildren ? (
                              <button
                                type="button"
                                className="w-6 h-6 inline-flex items-center justify-center rounded-md border border-[#d0d9e4] bg-white text-[#2b3d53] font-bold cursor-pointer transition-colors duration-150 hover:bg-[#eef5ff] outline-none"
                                onClick={() => toggleExpand(category._id)}
                                aria-label={isExpanded ? "Thu gọn danh mục" : "Mở rộng danh mục"}
                              >
                                {isExpanded ? (
                                  <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: "11px" }} />
                                ) : (
                                  <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: "11px" }} />
                                )}
                              </button>
                            ) : (
                              <span className="w-6 inline-flex items-center justify-center text-[#9aa9bc] font-bold" aria-hidden="true">
                                •
                              </span>
                            )}
                            <span>
                              {category.name}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center justify-center min-w-[52px] px-2 py-1 rounded-full text-[11px] font-bold ${
                          level === 0 ? "bg-[#e6f4ea] text-[#256d1b]" : level === 1 ? "bg-[#fff4e6] text-[#8a4b00]" : "bg-[#e8f0fe] text-[#1f4ea5]"
                        }`}>
                          {levelLabel(level)}
                        </span>
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <select
                            className="w-full p-2 pr-9 border border-[#c7d3e0] rounded-lg bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
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
                      <td className="p-3 text-[#2b3d53] min-w-[260px]">{getCategoryPath(category)}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                className="bg-status-success text-white inline-flex items-center gap-1 py-1.5 px-3 rounded-md border-0 cursor-pointer font-semibold transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_16px_rgba(10,27,43,0.1)]"
                                title="Lưu thay đổi"
                              >
                                <FontAwesomeIcon icon={faCheck} />
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCategory(null)}
                                className="bg-[#6b7280] text-white inline-flex items-center gap-1 py-1.5 px-3 rounded-md border-0 cursor-pointer font-semibold transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_16px_rgba(10,27,43,0.1)]"
                                title="Hủy chỉnh sửa"
                              >
                                <FontAwesomeIcon icon={faXmark} />
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
                                className="border border-[#d0d9e4] bg-white text-admin-ink inline-flex items-center gap-1 py-1.5 px-3 rounded-md cursor-pointer font-semibold transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_16px_rgba(10,27,43,0.1)]"
                                title="Chỉnh sửa danh mục"
                              >
                                <FontAwesomeIcon icon={faPen} />
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => setCategoryPendingDelete(category)}
                                className="bg-admin-accent-soft text-[#9a3412] border border-[rgba(154,52,18,0.18)] inline-flex items-center gap-1 py-1.5 px-3 rounded-md cursor-pointer font-semibold transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_16px_rgba(10,27,43,0.1)]"
                                title="Xóa danh mục"
                              >
                                <FontAwesomeIcon icon={faTrash} />
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
                    <td colSpan="5" className="text-center text-[#657589] p-5">
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
        <div className="fixed inset-0 bg-[rgba(9,17,27,0.5)] flex items-center justify-center z-[999] p-4" role="presentation">
          <div className="w-[min(460px,100%)] bg-white border border-admin-line rounded-xl p-5.5 shadow-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title" className="text-lg font-bold text-admin-ink m-0 mb-2">Xác nhận xóa danh mục</h3>
            <p className="text-sm text-admin-muted m-0 mb-3.5">
              Bạn có chắc chắn muốn xóa danh mục <strong>{categoryPendingDelete.name}</strong>?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="py-2.5 px-3.5 rounded-lg border border-[#d0d9e4] cursor-pointer font-semibold bg-[#e8edf3] text-[#0f2233] transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50"
                onClick={() => setCategoryPendingDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="py-2.5 px-3.5 rounded-lg cursor-pointer font-semibold bg-gradient-to-r from-admin-primary to-[#0f314f] text-white border-0 transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50"
                onClick={handleDelete}
                disabled={deleting}
              >
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
