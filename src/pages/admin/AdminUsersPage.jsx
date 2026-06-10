import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import "../../css/admin/users.css";

const ITEMS_PER_PAGE = 8;

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

  const initialPage = useMemo(() => {
    const parsed = Number(searchParams.get("page") || 1);
    if (Number.isNaN(parsed) || parsed < 1) {
      return 1;
    }
    return Math.floor(parsed);
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const hasInitializedFilters = useRef(false);

  useEffect(() => {
    if (!hasInitializedFilters.current) {
      hasInitializedFilters.current = true;
      return;
    }
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  const [userPendingPoints, setUserPendingPoints] = useState(null);
  const [newPoints, setNewPoints] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [updatingPoints, setUpdatingPoints] = useState(false);

  const [userPendingPassword, setUserPendingPassword] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const [userPendingRoleChange, setUserPendingRoleChange] = useState(null);
  const [newRolePending, setNewRolePending] = useState("");
  const [adminPasswordForRole, setAdminPasswordForRole] = useState("");
  const [updatingRole, setUpdatingRole] = useState(false);

  const handleToggleRole = (user) => {
    if (String(user._id) === String(currentUserId)) {
      setMessage("Không thể tự thay đổi vai trò của chính mình.");
      return;
    }
    const targetRole = user.role === "admin" ? "user" : "admin";
    setUserPendingRoleChange(user);
    setNewRolePending(targetRole);
    setAdminPasswordForRole("");
    setMessage("");
  };

  const handleSaveRoleChange = async () => {
    if (!userPendingRoleChange) return;

    if (newRolePending === "admin" && !adminPasswordForRole) {
      setMessage("Mật khẩu xác nhận của admin là bắt buộc.");
      return;
    }

    try {
      setUpdatingRole(true);
      const payload = {
        name: userPendingRoleChange.name,
        email: userPendingRoleChange.email,
        role: newRolePending,
      };

      if (newRolePending === "admin") {
        payload.adminPassword = adminPasswordForRole;
      }

      const data = await updateAdminUser(auth.token, userPendingRoleChange._id, payload);
      setUsers((prev) =>
        prev.map((u) => (u._id === userPendingRoleChange._id ? data.user : u))
      );
      setMessage(`Thay đổi vai trò thành công sang ${newRolePending}.`);
      setUserPendingRoleChange(null);
    } catch (error) {
      setMessage(getErrorMessage(error, "Không thể thay đổi vai trò."));
    } finally {
      setUpdatingRole(false);
    }
  };

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
    const dateObj = new Date(value);
    const timeStr = dateObj.toLocaleTimeString("vi-VN");
    const dateStr = dateObj.toLocaleDateString("vi-VN");
    return (
      <div className="datetime-stack" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span className="time-part" style={{ fontWeight: "500" }}>{timeStr}</span>
        <span className="date-part" style={{ fontSize: "0.85em", color: "#718096" }}>{dateStr}</span>
      </div>
    );
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

    if (currentPage > 1) {
      nextParams.set("page", String(currentPage));
    }

    setSearchParams(nextParams, { replace: true });
  }, [searchTerm, sortBy, currentPage, setSearchParams]);

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

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

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
                  <span
                    className={`role-badge ${user.role === "admin" ? "admin" : "user"} ${String(user._id) === String(currentUserId) ? "disabled" : ""}`}
                    onClick={() => String(user._id) !== String(currentUserId) && handleToggleRole(user)}
                    title={String(user._id) === String(currentUserId) ? "Không thể tự thay đổi vai trò của chính mình" : "Click để thay đổi vai trò"}
                  >
                    {user.role}
                  </span>
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
            {renderUsersTable("Tài khoản Người dùng", "Danh sách tài khoản khách hàng đang hoạt động.", paginatedCustomers)}
            {filteredCustomers.length > 0 && (
              <div className="dashboard-pagination">
                <p>
                  Hiển thị <strong>{paginatedCustomers.length}</strong> / {filteredCustomers.length} khách hàng
                </p>
                <div className="pagination-actions">
                  <button
                    type="button"
                    className="secondary-btn pager-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                    Trước
                  </button>
                  <span className="page-indicator">
                    Trang {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    className="secondary-btn pager-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    Sau
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>
                </div>
              </div>
            )}
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
      {/* Modal Thay Đổi Vai Trò */}
      {userPendingRoleChange && (
        <div className="confirm-modal-backdrop" role="presentation">
          <div className="confirm-modal password-modal" role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
            <h3 id="role-modal-title" className="modal-title">
              {newRolePending === "admin" ? "Nâng quyền lên Quản trị viên" : "Hạ quyền thành Khách hàng"}
            </h3>
            <p className="modal-subtitle">
              Thay đổi vai trò cho tài khoản: <strong>{userPendingRoleChange.email}</strong>
            </p>

            <div className="modal-form-grid">
              <div className="modal-form-group row-group">
                <span className="modal-label">Vai trò hiện tại</span>
                <span className="modal-value" style={{ textTransform: "capitalize" }}>
                  {userPendingRoleChange.role}
                </span>
              </div>

              <div className="modal-form-group row-group">
                <span className="modal-label">Vai trò mới</span>
                <span className="modal-value" style={{ textTransform: "capitalize", color: newRolePending === "admin" ? "#1d4ed8" : "#166534" }}>
                  {newRolePending}
                </span>
              </div>

              {newRolePending === "admin" && (
                <div className="modal-form-group">
                  <label htmlFor="admin-pass-role-input" className="modal-label">
                    Xác nhận mật khẩu của bạn (Admin)
                  </label>
                  <input
                    id="admin-pass-role-input"
                    type="password"
                    className="table-input modal-input"
                    placeholder="Nhập mật khẩu của bạn để xác nhận..."
                    value={adminPasswordForRole}
                    onChange={(e) => setAdminPasswordForRole(e.target.value)}
                  />
                </div>
              )}
            </div>

            <p style={{ fontSize: "13px", color: "#64748b", marginTop: "-6px", marginBottom: "16px" }}>
              {newRolePending === "admin"
                ? "Lưu ý: Tài khoản Quản trị viên sẽ có đầy đủ quyền thay đổi cấu hình hệ thống."
                : "Bạn có chắc chắn muốn hạ quyền của tài khoản quản trị viên này?"
              }
            </p>

            <div className="confirm-modal-actions">
              <button
                type="button"
                className="secondary-btn modal-btn"
                onClick={() => setUserPendingRoleChange(null)}
                disabled={updatingRole}
              >
                Hủy
              </button>
              <button
                type="button"
                className={`modal-btn ${newRolePending === "admin" ? "modal-btn-save-password" : "secondary-btn"}`}
                onClick={handleSaveRoleChange}
                disabled={updatingRole}
                style={newRolePending === "user" ? { backgroundColor: "#b91c1c", color: "#fff", borderColor: "#b91c1c" } : {}}
              >
                {updatingRole ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminUsersPage;
