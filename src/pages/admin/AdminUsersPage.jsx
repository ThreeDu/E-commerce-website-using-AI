import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useStatusMessageBridge } from "../../hooks/useStatusMessageBridge";
import {
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
  updateAdminUserPoints,
  updateAdminUserPassword,
} from "../../services/admin/userService";
import { getErrorMessage } from "../../utils/adminErrorUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPen,
  faCoins,
  faKey,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
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
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "newest");
  const [editForm, setEditForm] = useState({ name: "", email: "" });

  const [userPendingPoints, setUserPendingPoints] = useState(null);
  const [newPoints, setNewPoints] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [updatingPoints, setUpdatingPoints] = useState(false);

  const [userPendingPassword, setUserPendingPassword] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleStartEditPoints = (user) => {
    setUserPendingPoints(user);
    setNewPoints(user.loyaltyPoints || 0);
    setPointsReason("");
    setMessage("");
  };

  const handleSavePoints = async () => {
    if (!userPendingPoints) return;
    if (newPoints === "" || isNaN(Number(newPoints)) || Number(newPoints) < 0) {
      setMessage("Số điểm không hợp lệ (phải là số >= 0).");
      return;
    }

    try {
      setUpdatingPoints(true);
      const data = await updateAdminUserPoints(
        auth.token,
        userPendingPoints._id,
        Number(newPoints),
        pointsReason
      );
      setUsers((prev) =>
        prev.map((user) =>
          user._id === userPendingPoints._id
            ? { ...user, loyaltyPoints: data.loyaltyPoints }
            : user
        )
      );
      setMessage("Cập nhật điểm tích lũy thành công.");
      setUserPendingPoints(null);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật điểm tích lũy."));
    } finally {
      setUpdatingPoints(false);
    }
  };

  const handleStartEditPassword = (user) => {
    setUserPendingPassword(user);
    setNewPassword("");
    setConfirmPassword("");
    setMessage("");
  };

  const handleSavePassword = async () => {
    if (!userPendingPassword) return;
    if (!newPassword || newPassword.length < 6) {
      setMessage("Mật khẩu mới phải có tối thiểu 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setUpdatingPassword(true);
      await updateAdminUserPassword(auth.token, userPendingPassword._id, newPassword);
      setMessage("Đổi mật khẩu người dùng thành công.");
      setUserPendingPassword(null);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể cập nhật mật khẩu."));
    } finally {
      setUpdatingPassword(false);
    }
  };

  useStatusMessageBridge(message, { title: "Người dùng" });

  const formatDateTime = useCallback((value) => {
    if (!value) {
      return "-";
    }
    return new Date(value).toLocaleString("vi-VN");
  }, []);

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

    if (sortBy !== "newest") {
      nextParams.set("sort", sortBy);
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchTerm, sortBy, setSearchParams]);

  const startEdit = (user) => {
    setEditingUserId(user._id);
    setEditForm({ name: user.name, email: user.email });
    setMessage("");
  };

  const cancelEdit = () => {
    setEditingUserId("");
    setEditForm({ name: "", email: "" });
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

    if (userPendingDelete.role === "admin") {
      setMessage("Không thể xóa tài khoản admin.");
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

      return matchesSearch;
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
  }, [users, searchTerm, sortBy]);

  const filteredAdmins = useMemo(
    () => filteredUsers.filter((user) => user.role === "admin"),
    [filteredUsers]
  );

  const filteredCustomers = useMemo(
    () => filteredUsers.filter((user) => user.role !== "admin"),
    [filteredUsers]
  );

  const totalUsers = users.length;
  const totalAdmins = users.filter((user) => user.role === "admin").length;
  const totalCustomers = users.filter((user) => user.role !== "admin").length;

  const renderUsersTable = (tableTitle, tableDescription, list) => (
    <div className="users-role-section">
      <div className="users-role-header">
        <h3>{tableTitle}</h3>
        <p>{tableDescription}</p>
      </div>

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Điểm</th>
              <th>Vai trò</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {list.map((user) => (
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
                  {(user.loyaltyPoints || 0).toLocaleString("vi-VN")}
                </td>
                <td>
                  <span className={`role-badge ${user.role === "admin" ? "admin" : "user"}`}>{user.role}</span>
                </td>
                <td>{formatDateTime(user.createdAt)}</td>
                <td>
                  {editingUserId === user._id ? (
                    <div className="table-actions">
                      <button type="button" onClick={() => handleSaveEdit(user._id)} className="action-btn-points">
                        Lưu
                      </button>
                      <button type="button" onClick={cancelEdit} className="action-btn-edit">
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="table-actions">
                      <button
                        type="button"
                        onClick={() => startEdit(user)}
                        title="Sửa thông tin"
                        className="action-btn-edit"
                      >
                        <FontAwesomeIcon icon={faPen} /> Sửa
                      </button>
                      {user.role !== "admin" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditPoints(user)}
                            title="Điều chỉnh điểm tích lũy"
                            className="action-btn-points"
                          >
                            <FontAwesomeIcon icon={faCoins} /> Điểm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditPassword(user)}
                            title="Đặt lại mật khẩu"
                            className="action-btn-password"
                          >
                            <FontAwesomeIcon icon={faKey} /> Mật khẩu
                          </button>
                        </>
                      )}
                      {String(user._id) === String(currentUserId) ? (
                        <button type="button" className="danger-btn" disabled>
                          Hiện tại
                        </button>
                      ) : user.role === "admin" ? (
                        <button type="button" className="danger-btn" disabled>
                          Admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="danger-btn"
                          onClick={() => setUserPendingDelete(user)}
                          title="Xóa người dùng"
                        >
                          <FontAwesomeIcon icon={faTrash} /> Xóa
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan="6" className="users-empty-cell">
                  Không có dữ liệu ở nhóm này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <main className="container page-content admin-users-page">
      <section className="hero-card admin-page-enter" aria-busy={loading || deleting}>
        <div className="users-header-row">
          <div>
            <h2>Quản lý người dùng</h2>
            <p className="users-subtitle">Theo dõi tài khoản, phân quyền và cập nhật thông tin người dùng trong hệ thống.</p>
          </div>
        </div>

        <div className="users-metric-grid" aria-label="Thống kê người dùng">
          <article className="users-metric-card">
            <span>Tổng tài khoản</span>
            <strong>{totalUsers}</strong>
          </article>
          <article className="users-metric-card admin">
            <span>Admin</span>
            <strong>{totalAdmins}</strong>
          </article>
          <article className="users-metric-card user">
            <span>Người dùng</span>
            <strong>{totalCustomers}</strong>
          </article>
        </div>

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
          <>
            {renderUsersTable("Tài khoản Admin", "Danh sách tài khoản có quyền quản trị hệ thống.", filteredAdmins)}
            {renderUsersTable("Tài khoản Người dùng", "Danh sách tài khoản khách hàng đang hoạt động.", filteredCustomers)}
          </>
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

      {/* Modal Thay Đổi Điểm */}
      {userPendingPoints && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal points-modal" role="dialog" aria-modal="true" aria-labelledby="points-modal-title">
            <h3 id="points-modal-title" className="modal-title">
              Điều chỉnh điểm tích lũy
            </h3>
            <p className="modal-subtitle">
              Cập nhật điểm thưởng cho tài khoản: <strong>{userPendingPoints.email}</strong>
            </p>

            <div className="modal-form-grid">
              <div className="modal-form-group row-group">
                <span className="modal-label">Điểm hiện tại</span>
                <span className="modal-value">
                  {(userPendingPoints.loyaltyPoints || 0).toLocaleString("vi-VN")} điểm
                </span>
              </div>

              <div className="modal-form-group">
                <label htmlFor="new-points-input" className="modal-label">
                  Điểm mới
                </label>
                <input
                  id="new-points-input"
                  type="number"
                  min="0"
                  className="table-input modal-input"
                  placeholder="Nhập số điểm mới..."
                  value={newPoints}
                  onChange={(e) => setNewPoints(e.target.value)}
                />
              </div>

              <div className="modal-form-group">
                <label htmlFor="points-reason-input" className="modal-label">
                  Lý do thay đổi
                </label>
                <textarea
                  id="points-reason-input"
                  rows="3"
                  className="table-input modal-textarea"
                  placeholder="Nhập lý do điều chỉnh điểm (ví dụ: Tặng điểm sinh nhật, sửa lỗi giao dịch...)"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                />
              </div>
            </div>

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-btn modal-btn"
                onClick={() => setUserPendingPoints(null)}
                disabled={updatingPoints}
              >
                Hủy
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-save-points"
                onClick={handleSavePoints}
                disabled={updatingPoints}
              >
                {updatingPoints ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thay Đổi Mật Khẩu */}
      {userPendingPassword && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
            <h3 id="password-modal-title" className="modal-title">
              Thay đổi mật khẩu người dùng
            </h3>
            <p className="modal-subtitle">
              Đặt lại mật khẩu cho tài khoản: <strong>{userPendingPassword.email}</strong>
            </p>

            <div className="modal-form-grid">
              <div className="modal-form-group">
                <label htmlFor="new-password-input" className="modal-label">
                  Mật khẩu mới
                </label>
                <input
                  id="new-password-input"
                  type="password"
                  className="table-input modal-input"
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="modal-form-group">
                <label htmlFor="confirm-password-input" className="modal-label">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="confirm-password-input"
                  type="password"
                  className="table-input modal-input"
                  placeholder="Nhập lại mật khẩu mới để xác nhận..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-btn modal-btn"
                onClick={() => setUserPendingPassword(null)}
                disabled={updatingPassword}
              >
                Hủy
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-save-password"
                onClick={handleSavePassword}
                disabled={updatingPassword}
              >
                {updatingPassword ? "Đang lưu..." : "Đổi mật khẩu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminUsersPage;
