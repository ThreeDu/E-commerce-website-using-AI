import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from "../../services/admin/categoryService";
import "./AdminPages.css";

function AdminCategoriesPage() {
  const { auth } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [mainName, setMainName] = useState("");
  const [subLevel2Name, setSubLevel2Name] = useState("");
  const [subLevel3Name, setSubLevel3Name] = useState("");
  const [selectedMainId, setSelectedMainId] = useState("");
  const [selectedLevel2Id, setSelectedLevel2Id] = useState("");

  const [editMain, setEditMain] = useState(null);
  const [editLevel2, setEditLevel2] = useState(null);
  const [editLevel3, setEditLevel3] = useState(null);

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
      let level = 0;
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

        level += 1;
        cursor = parent;
      }

      return level;
    },
    [categoriesById]
  );

  const mainCategories = useMemo(
    () => categories.filter((item) => getCategoryLevel(item) === 0),
    [categories, getCategoryLevel]
  );

  const level2Categories = useMemo(
    () => categories.filter((item) => getCategoryLevel(item) === 1),
    [categories, getCategoryLevel]
  );

  const level3Categories = useMemo(
    () => categories.filter((item) => getCategoryLevel(item) === 2),
    [categories, getCategoryLevel]
  );

  const handleAddMain = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      await createAdminCategory(auth.token, { name: mainName.trim() });
      setMainName("");
      setMessage("Thêm danh mục chính thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleAddLevel2 = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!selectedMainId) {
      setMessage("Vui lòng chọn danh mục chính trước khi thêm danh mục phụ cấp 2.");
      return;
    }

    try {
      await createAdminCategory(auth.token, {
        name: subLevel2Name.trim(),
        parentId: selectedMainId,
      });
      setSubLevel2Name("");
      setMessage("Thêm danh mục phụ cấp 2 thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleAddLevel3 = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!selectedLevel2Id) {
      setMessage("Vui lòng chọn danh mục phụ cấp 2 trước khi thêm danh mục phụ cấp 3.");
      return;
    }

    try {
      await createAdminCategory(auth.token, {
        name: subLevel3Name.trim(),
        parentId: selectedLevel2Id,
      });
      setSubLevel3Name("");
      setMessage("Thêm danh mục phụ cấp 3 thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleDelete = async (category) => {
    const isConfirmed = window.confirm(`Bạn có chắc chắn muốn xóa danh mục "${category.name}"?`);
    if (!isConfirmed) {
      return;
    }

    try {
      setMessage("");
      await deleteAdminCategory(auth.token, category._id);
      setMessage("Xóa danh mục thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSaveMain = async () => {
    if (!editMain?.name?.trim()) {
      setMessage("Tên danh mục chính không được để trống.");
      return;
    }

    try {
      await updateAdminCategory(auth.token, editMain._id, {
        name: editMain.name.trim(),
        parentId: null,
      });
      setEditMain(null);
      setMessage("Cập nhật danh mục chính thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSaveLevel2 = async () => {
    if (!editLevel2?.name?.trim()) {
      setMessage("Tên danh mục phụ cấp 2 không được để trống.");
      return;
    }

    if (!editLevel2?.parentId) {
      setMessage("Danh mục phụ cấp 2 cần có danh mục chính.");
      return;
    }

    try {
      await updateAdminCategory(auth.token, editLevel2._id, {
        name: editLevel2.name.trim(),
        parentId: editLevel2.parentId,
      });
      setEditLevel2(null);
      setMessage("Cập nhật danh mục phụ cấp 2 thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSaveLevel3 = async () => {
    if (!editLevel3?.name?.trim()) {
      setMessage("Tên danh mục phụ cấp 3 không được để trống.");
      return;
    }

    if (!editLevel3?.parentId) {
      setMessage("Danh mục phụ cấp 3 cần có danh mục phụ cấp 2.");
      return;
    }

    try {
      await updateAdminCategory(auth.token, editLevel3._id, {
        name: editLevel3.name.trim(),
        parentId: editLevel3.parentId,
      });
      setEditLevel3(null);
      setMessage("Cập nhật danh mục phụ cấp 3 thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const getParentName = (category) => {
    const parent = categoriesById.get(String(category.parentId));
    return parent?.name || "Không rõ";
  };

  const getMainParentNameForLevel3 = (category) => {
    const level2Parent = categoriesById.get(String(category.parentId));
    if (!level2Parent?.parentId) {
      return "Không rõ";
    }

    const mainParent = categoriesById.get(String(level2Parent.parentId));
    return mainParent?.name || "Không rõ";
  };

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Quản lý danh mục</h2>
        <p>Quản lý danh mục chính, danh mục phụ cấp 2 và danh mục phụ cấp 3.</p>
        {message && <p className="form-message">{message}</p>}

        {loading ? (
          <p>Đang tải danh mục...</p>
        ) : (
          <div className="category-manager-grid">
            <div className="category-card">
              <h3>Danh mục chính</h3>
              <form className="category-form" onSubmit={handleAddMain}>
                <input
                  value={mainName}
                  onChange={(event) => setMainName(event.target.value)}
                  placeholder="Nhập tên danh mục chính"
                  required
                />
                <button type="submit">Thêm</button>
              </form>

              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Tên danh mục</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainCategories.map((category) => (
                      <tr key={category._id}>
                        <td>
                          {editMain?._id === category._id ? (
                            <input
                              className="table-input"
                              value={editMain.name}
                              onChange={(event) =>
                                setEditMain((prev) => ({ ...prev, name: event.target.value }))
                              }
                            />
                          ) : (
                            category.name
                          )}
                        </td>
                        <td>
                          <div className="table-actions">
                            {editMain?._id === category._id ? (
                              <>
                                <button type="button" onClick={handleSaveMain}>
                                  Lưu
                                </button>
                                <button type="button" onClick={() => setEditMain(null)}>
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditMain({ _id: category._id, name: category.name })}
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  className="danger-btn"
                                  onClick={() => handleDelete(category)}
                                >
                                  Xóa
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="category-card">
              <h3>Danh mục phụ cấp 2</h3>
              <form className="category-form" onSubmit={handleAddLevel2}>
                <select
                  value={selectedMainId}
                  onChange={(event) => setSelectedMainId(event.target.value)}
                  required
                >
                  <option value="">Chọn danh mục chính</option>
                  {mainCategories.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  value={subLevel2Name}
                  onChange={(event) => setSubLevel2Name(event.target.value)}
                  placeholder="Nhập tên danh mục phụ cấp 2"
                  required
                />
                <button type="submit">Thêm</button>
              </form>

              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Danh mục cấp 2</th>
                      <th>Thuộc danh mục chính</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {level2Categories.map((category) => (
                      <tr key={category._id}>
                        <td>
                          {editLevel2?._id === category._id ? (
                            <input
                              className="table-input"
                              value={editLevel2.name}
                              onChange={(event) =>
                                setEditLevel2((prev) => ({ ...prev, name: event.target.value }))
                              }
                            />
                          ) : (
                            category.name
                          )}
                        </td>
                        <td>
                          {editLevel2?._id === category._id ? (
                            <select
                              className="table-select"
                              value={editLevel2.parentId}
                              onChange={(event) =>
                                setEditLevel2((prev) => ({ ...prev, parentId: event.target.value }))
                              }
                            >
                              {mainCategories.map((item) => (
                                <option key={item._id} value={item._id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            getParentName(category)
                          )}
                        </td>
                        <td>
                          <div className="table-actions">
                            {editLevel2?._id === category._id ? (
                              <>
                                <button type="button" onClick={handleSaveLevel2}>
                                  Lưu
                                </button>
                                <button type="button" onClick={() => setEditLevel2(null)}>
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditLevel2({
                                      _id: category._id,
                                      name: category.name,
                                      parentId: category.parentId,
                                    })
                                  }
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  className="danger-btn"
                                  onClick={() => handleDelete(category)}
                                >
                                  Xóa
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="category-card">
              <h3>Danh mục phụ cấp 3</h3>
              <form className="category-form" onSubmit={handleAddLevel3}>
                <select
                  value={selectedLevel2Id}
                  onChange={(event) => setSelectedLevel2Id(event.target.value)}
                  required
                >
                  <option value="">Chọn danh mục phụ cấp 2</option>
                  {level2Categories.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  value={subLevel3Name}
                  onChange={(event) => setSubLevel3Name(event.target.value)}
                  placeholder="Nhập tên danh mục phụ cấp 3"
                  required
                />
                <button type="submit">Thêm</button>
              </form>

              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Danh mục cấp 3</th>
                      <th>Danh mục cấp 2</th>
                      <th>Danh mục chính</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {level3Categories.map((category) => (
                      <tr key={category._id}>
                        <td>
                          {editLevel3?._id === category._id ? (
                            <input
                              className="table-input"
                              value={editLevel3.name}
                              onChange={(event) =>
                                setEditLevel3((prev) => ({ ...prev, name: event.target.value }))
                              }
                            />
                          ) : (
                            category.name
                          )}
                        </td>
                        <td>
                          {editLevel3?._id === category._id ? (
                            <select
                              className="table-select"
                              value={editLevel3.parentId}
                              onChange={(event) =>
                                setEditLevel3((prev) => ({ ...prev, parentId: event.target.value }))
                              }
                            >
                              {level2Categories.map((item) => (
                                <option key={item._id} value={item._id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            getParentName(category)
                          )}
                        </td>
                        <td>{getMainParentNameForLevel3(category)}</td>
                        <td>
                          <div className="table-actions">
                            {editLevel3?._id === category._id ? (
                              <>
                                <button type="button" onClick={handleSaveLevel3}>
                                  Lưu
                                </button>
                                <button type="button" onClick={() => setEditLevel3(null)}>
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditLevel3({
                                      _id: category._id,
                                      name: category.name,
                                      parentId: category.parentId,
                                    })
                                  }
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  className="danger-btn"
                                  onClick={() => handleDelete(category)}
                                >
                                  Xóa
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminCategoriesPage;
