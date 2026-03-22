import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
} from "../../services/admin/userService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import "../../css/admin/users.css";

function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { auth } = useAuth();
  const currentUserId = auth?.user?.id;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [userPendingDelete, setUserPendingDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "all");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "newest");
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "user" });

  const loadUsers = useCallback(async () => {
    if (!auth?.token) {
      return;
    }

    try {
      setLoading(true);
      const data = await getAdminUsers(auth.token);
      setUsers(data.users || []);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể tải danh sách người dùng."));
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const nextParams = new URLSearchParams();

    if (searchTerm.trim()) {
      nextParams.set("q", searchTerm.trim());
    }

    if (roleFilter !== "all") {
      nextParams.set("role", roleFilter);
    }

    if (sortBy !== "newest") {
      nextParams.set("sort", sortBy);
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchTerm, roleFilter, sortBy, setSearchParams]);

  const startEdit = (user) => {
    setEditingUserId(user._id);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setMessage("");
  };

  const cancelEdit = () => {
    setEditingUserId("");
    setEditForm({ name: "", email: "", role: "user" });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async (userId) => {
    try {
      const data = await updateAdminUser(auth.token, userId, editForm);
      setUsers((prev) => prev.map((user) => (user._id === userId ? data.user : user)));
      setMessage("Cập nhật người dùng thành công.");
      cancelEdit();
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật người dùng."));
    }
  };

  const handleDelete = async () => {
    if (!userPendingDelete?._id) {
      return;
    }

    if (String(userPendingDelete._id) === String(currentUserId)) {
      setMessage("Không thể xóa chính tài khoản admin đang sử dụng.");
      return;
    }

    try {
      setDeleting(true);
      await deleteAdminUser(auth.token, userPendingDelete._id);
      setUsers((prev) => prev.filter((user) => user._id !== userPendingDelete._id));
      setMessage("Xóa người dùng thành công.");
      setUserPendingDelete(null);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể xóa người dùng."));
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const list = users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        (user.name || "").toLowerCase().includes(normalizedSearch) ||
        (user.email || "").toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });

    list.sort((a, b) => {
      if (sortBy === "name-asc") {
        return (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base" });
      }
      if (sortBy === "name-desc") {
        return (b.name || "").localeCompare(a.name || "", "vi", { sensitivity: "base" });
      }

      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return sortBy === "oldest" ? timeA - timeB : timeB - timeA;
    });

    return list;
  }, [users, searchTerm, roleFilter, sortBy]);

  return (
    <main className="container page-content">
      <section className="hero-card" aria-busy={loading || deleting}>
        <h2>Quản lý người dùng</h2>
        {message && (
          <p className="form-message" role="status" aria-live="polite">
            {message}
          </p>
        )}

        <div className="users-filter-bar">
          <div className="users-filter-control users-search-control">
            <label htmlFor="users-search">Tìm kiếm</label>
            <input
              id="users-search"
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="users-filter-control">
            <label htmlFor="users-role">Vai trò</label>
            <select
              id="users-role"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="admin">admin</option>
              <option value="user">user</option>
            </select>
          </div>

          <div className="users-filter-control">
            <label htmlFor="users-sort">Sắp xếp</label>
            <select id="users-sort" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="name-asc">Tên A-Z</option>
              <option value="name-desc">Tên Z-A</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p>Đang tải danh sách người dùng...</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id}>
                    <td>
                      {editingUserId === user._id ? (
                        <input
                          className="table-input"
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                        />
                      ) : (
                        user.name
                      )}
                    </td>
                    <td>
                      {editingUserId === user._id ? (
                        <input
                          className="table-input"
                          name="email"
                          value={editForm.email}
                          onChange={handleEditChange}
                        />
                      ) : (
                        user.email
                      )}
                    </td>
                    <td>
                      {editingUserId === user._id ? (
                        <select
                          className="table-select"
                          name="role"
                          value={editForm.role}
                          onChange={handleEditChange}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      ) : (
                        user.role
                      )}
                    </td>
                    <td>
                      {editingUserId === user._id ? (
                        <div className="table-actions">
                          <button type="button" onClick={() => handleSaveEdit(user._id)}>
                            Lưu
                          </button>
                          <button type="button" onClick={cancelEdit}>
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="table-actions">
                          <button type="button" onClick={() => startEdit(user)}>
                            Sửa
                          </button>
                          {String(user._id) === String(currentUserId) ? (
                            <button type="button" className="danger-btn" disabled>
                              Tài khoản hiện tại
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="danger-btn"
                              onClick={() => setUserPendingDelete(user)}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="4" className="users-empty-cell">
                      Không tìm thấy người dùng phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {userPendingDelete && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
            <h3 id="delete-user-title">Xác nhận xóa người dùng</h3>
            <p>
              Bạn có chắc chắn muốn xóa tài khoản <strong>{userPendingDelete.email}</strong>?
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setUserPendingDelete(null)}
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

export default AdminUsersPage;
