import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
} from "../../services/admin/userService";
import "./AdminPages.css";

function AdminUsersPage() {
  const { auth } = useAuth();
  const currentUserId = auth?.user?.id;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
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
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [auth?.token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
      setMessage(error.message);
    }
  };

  const handleDelete = async (userId) => {
    if (String(userId) === String(currentUserId)) {
      setMessage("Không thể xóa chính tài khoản admin đang sử dụng.");
      return;
    }

    const isConfirmed = window.confirm("Bạn có chắc chắn muốn xóa tài khoản này?");
    if (!isConfirmed) {
      return;
    }

    try {
      await deleteAdminUser(auth.token, userId);
      setUsers((prev) => prev.filter((user) => user._id !== userId));
      setMessage("Xóa người dùng thành công.");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <main className="container page-content">
      <section className="hero-card">
        <h2>Quản lý người dùng</h2>
        {message && <p className="form-message">{message}</p>}

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
                {users.map((user) => (
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
                              onClick={() => handleDelete(user._id)}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminUsersPage;
