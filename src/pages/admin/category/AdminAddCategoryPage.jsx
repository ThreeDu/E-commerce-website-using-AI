import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useStatusMessageBridge } from "../../../hooks/useStatusMessageBridge";
import { createAdminCategory, getAdminCategories } from "../../../services/admin/categoryService";
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

  useStatusMessageBridge(message, { title: "Danh mục" });

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
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="relative border border-admin-line rounded-[24px] p-8 shadow-admin bg-gradient-to-br from-white to-[#f8fbff] animate-admin-rise">
        <h2 className="text-[25px] font-bold tracking-tight text-admin-ink mt-0 mb-1">Thêm danh mục</h2>
        <p className="text-sm text-admin-muted mt-2 mb-0 max-w-[760px] leading-relaxed">
          Tạo danh mục mới theo cấp: chính, phụ cấp 2 hoặc phụ cấp 3.
        </p>
        {message && (
          <p className="mt-3 rounded-[10px] p-[10px_12px] border border-[#ffd8a8] bg-[#fff8ef] text-[#9a3412] text-sm font-semibold">
            {message}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-admin-muted py-4">Đang tải dữ liệu danh mục...</p>
        ) : (
          <form className="mt-6 max-w-[620px] grid gap-4" onSubmit={handleSubmit}>
            <label htmlFor="category-level" className="text-[13px] font-bold text-[#1f3348] tracking-wide">
              Cấp danh mục
            </label>
            <select
              id="category-level"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
              value={level}
              onChange={handleLevelChange}
            >
              <option value="1">Danh mục chính (cấp 1)</option>
              <option value="2">Danh mục phụ cấp 2</option>
              <option value="3">Danh mục phụ cấp 3</option>
            </select>

            {level === "2" && (
              <>
                <label htmlFor="main-parent" className="text-[13px] font-bold text-[#1f3348] tracking-wide">
                  Danh mục chính
                </label>
                <select
                  id="main-parent"
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
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
                <label htmlFor="level2-parent" className="text-[13px] font-bold text-[#1f3348] tracking-wide">
                  Danh mục phụ cấp 2
                </label>
                <select
                  id="level2-parent"
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
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

            <label htmlFor="category-name" className="text-[13px] font-bold text-[#1f3348] tracking-wide">
              Tên danh mục
            </label>
            <input
              id="category-name"
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Giày thể thao"
              required
            />
            <p className="text-xs text-[#63768e] mt-0.5">
              Mẹo: đặt tên ngắn gọn, thống nhất theo nhóm sản phẩm để dễ tìm kiếm.
            </p>

            <div className="flex gap-2.5 mt-2">
              <button
                type="submit"
                className="min-w-[124px] bg-gradient-to-r from-admin-primary to-[#0f314f] text-white py-2.5 px-3.5 rounded-full font-semibold transition-all duration-150 cursor-pointer hover:-translate-y-px hover:shadow-[0_9px_16px_rgba(9,26,44,0.14)] disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={saving}
              >
                {saving ? "Đang thêm..." : "Thêm danh mục"}
              </button>
              <button
                type="button"
                className="min-w-[124px] bg-[#e8edf3] text-[#0f2233] py-2.5 px-3.5 rounded-full font-semibold transition-all duration-150 cursor-pointer hover:-translate-y-px hover:shadow-[0_9px_16px_rgba(9,26,44,0.14)] disabled:opacity-70 disabled:cursor-not-allowed"
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
