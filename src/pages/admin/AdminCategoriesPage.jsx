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
  const [subName, setSubName] = useState("");
  const [selectedMainId, setSelectedMainId] = useState("");

  const [editMain, setEditMain] = useState(null);
  const [editSub, setEditSub] = useState(null);

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

  const mainCategories = useMemo(
    () => categories.filter((item) => !item.parentId),
    [categories]
  );

  const subCategories = useMemo(
    () => categories.filter((item) => item.parentId),
    [categories]
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

  const handleAddSub = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!selectedMainId) {
      setMessage("Vui lòng chọn danh mục chính trước khi thêm danh mục phụ.");
      return;
    }

    try {
      await createAdminCategory(auth.token, {
        name: subName.trim(),
        parentId: selectedMainId,
      });
      setSubName("");
      setMessage("Thêm danh mục phụ thành công.");
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

  const handleSaveSub = async () => {
    if (!editSub?.name?.trim()) {
      setMessage("Tên danh mục phụ không được để trống.");
      return;
    }

    if (!editSub?.parentId) {
      setMessage("Danh mục phụ cần có danh mục chính.");
      return;
    }

    try {
      await updateAdminCategory(auth.token, editSub._id, {
        name: editSub.name.trim(),
        parentId: editSub.parentId,
      });
      setEditSub(null);
      setMessage("Cập nhật danh mục phụ thành công.");
      await loadCategories();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const getParentName = (subCategory) => {
    const parent = mainCategories.find((item) => String(item._id) === String(subCategory.parentId));
    return parent?.name || "Không rõ";
  };

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Quản lý danh mục</h2>
        <p>Quản lý danh mục chính và danh mục phụ (2 cấp).</p>
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
              <h3>Danh mục phụ</h3>
              <form className="category-form" onSubmit={handleAddSub}>
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
                  value={subName}
                  onChange={(event) => setSubName(event.target.value)}
                  placeholder="Nhập tên danh mục phụ"
                  required
                />
                <button type="submit">Thêm</button>
              </form>

              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Danh mục phụ</th>
                      <th>Thuộc danh mục chính</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subCategories.map((category) => (
                      <tr key={category._id}>
                        <td>
                          {editSub?._id === category._id ? (
                            <input
                              className="table-input"
                              value={editSub.name}
                              onChange={(event) =>
                                setEditSub((prev) => ({ ...prev, name: event.target.value }))
                              }
                            />
                          ) : (
                            category.name
                          )}
                        </td>
                        <td>
                          {editSub?._id === category._id ? (
                            <select
                              className="table-select"
                              value={editSub.parentId}
                              onChange={(event) =>
                                setEditSub((prev) => ({ ...prev, parentId: event.target.value }))
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
                            {editSub?._id === category._id ? (
                              <>
                                <button type="button" onClick={handleSaveSub}>
                                  Lưu
                                </button>
                                <button type="button" onClick={() => setEditSub(null)}>
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditSub({
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
