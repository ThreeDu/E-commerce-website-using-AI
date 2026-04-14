import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { createAdminCategory, getAdminCategories } from "../../../services/admin/categoryService";
import "../../../css/admin/categories.css";

function AdminAddCategoryPage() {
  const navigate = useNavigate();
  const { auth } = useAuth();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [level, setLevel] = useState("1");
  const [selectedMainId, setSelectedMainId] = useState("");
  const [selectedLevel2Id, setSelectedLevel2Id] = useState("");

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

  const mainCategories = useMemo(
    () => categories.filter((item) => getCategoryLevel(item) === 0),
    [categories, getCategoryLevel]
  );

  const level2Categories = useMemo(
    () => categories.filter((item) => getCategoryLevel(item) === 1),
    [categories, getCategoryLevel]
  );

  const handleLevelChange = (event) => {
    const nextLevel = event.target.value;
    setLevel(nextLevel);
    setSelectedMainId("");
    setSelectedLevel2Id("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage("Tên danh mục không được để trống.");
      return;
    }

    let parentId = null;
    if (level === "2") {
      if (!selectedMainId) {
        setMessage("Vui lòng chọn danh mục chính.");
        return;
      }
      parentId = selectedMainId;
    }

    if (level === "3") {
      if (!selectedLevel2Id) {
        setMessage("Vui lòng chọn danh mục phụ cấp 2.");
        return;
      }
      parentId = selectedLevel2Id;
    }

    try {
      setSaving(true);
      await createAdminCategory(auth.token, {
        name: trimmedName,
        parentId,
      });

      navigate("/admin/categories", {
        state: { successMessage: "Thêm danh mục thành công." },
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container page-content">
      <section className="hero-card admin-form-surface">
        <h2>Thêm danh mục</h2>
        <p className="admin-surface-subtitle">Tạo danh mục mới theo cấp: chính, phụ cấp 2 hoặc phụ cấp 3.</p>
        {message && <p className="form-message">{message}</p>}

        {loading ? (
          <p>Đang tải dữ liệu danh mục...</p>
        ) : (
          <form className="category-create-form" onSubmit={handleSubmit}>
            <label htmlFor="category-level">Cấp danh mục</label>
            <select id="category-level" value={level} onChange={handleLevelChange}>
              <option value="1">Danh mục chính (cấp 1)</option>
              <option value="2">Danh mục phụ cấp 2</option>
              <option value="3">Danh mục phụ cấp 3</option>
            </select>

            {level === "2" && (
              <>
                <label htmlFor="main-parent">Danh mục chính</label>
                <select
                  id="main-parent"
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
              </>
            )}

            {level === "3" && (
              <>
                <label htmlFor="level2-parent">Danh mục phụ cấp 2</label>
                <select
                  id="level2-parent"
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
              </>
            )}

            <label htmlFor="category-name">Tên danh mục</label>
            <input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Giày thể thao"
              required
            />
            <p className="admin-form-note">Mẹo: đặt tên ngắn gọn, thống nhất theo nhóm sản phẩm để dễ tìm kiếm.</p>

            <div className="add-form-actions">
              <button type="submit" disabled={saving}>
                {saving ? "Đang thêm..." : "Thêm danh mục"}
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => navigate("/admin/categories")}
                disabled={saving}
              >
                Quay lại
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

export default AdminAddCategoryPage;
