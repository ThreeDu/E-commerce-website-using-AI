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
    <div className="mt-5">
      <div className="mb-2">
        <h3 className="m-0 text-base font-bold text-admin-ink">{tableTitle}</h3>
        <p className="m-0 mt-1 text-admin-muted text-xs font-medium">{tableDescription}</p>
      </div>

      <div className="border border-[#dde7f3] rounded-2xl overflow-hidden bg-white w-full max-w-full shadow-xs mt-3">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed bg-white">
            <thead>
              <tr className="bg-[#f2f7ff] text-[#4a5c75] [&>th]:p-3 [&>th]:font-bold [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider [&>th]:border-b [&>th]:border-admin-line">
                <th className="w-[18%]">Họ tên</th>
                <th className="w-[20%]">Email</th>
                <th className="w-[8%]">Điểm</th>
                <th className="w-[8%]">Vai trò</th>
                <th className="w-[16%]">Ngày tạo</th>
                <th className="w-[30%]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {list.map((user) => (
                <tr key={user._id} className="transition-colors hover:bg-[#f8fbff] [&>td]:p-3 [&>td]:align-middle">
                  <td className="whitespace-normal break-words font-semibold text-admin-ink">
                    {editingUserId === user._id ? (
                      <input
                        className="w-full border border-admin-line rounded-lg p-1.5 text-sm bg-white focus:outline-none focus:border-admin-primary"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                      />
                  ) : (
                    user.name
                  )}
                </td>
                <td className="truncate text-admin-muted text-sm">
                  {editingUserId === user._id ? (
                    <input
                      className="w-full border border-admin-line rounded-lg p-1.5 text-sm bg-white focus:outline-none focus:border-admin-primary"
                      name="email"
                      value={editForm.email}
                      onChange={handleEditChange}
                    />
                  ) : (
                    user.email
                  )}
                </td>
                <td className="truncate text-admin-ink font-semibold">
                  {(user.loyaltyPoints || 0).toLocaleString("vi-VN")}
                </td>
                <td>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer select-none transition-all duration-200 hover:-translate-y-px active:translate-y-0 ${
                      user.role === "admin"
                        ? "bg-[#e8f1ff] text-blue-700 border-[#bcd2ff] hover:shadow-[0_4px_10px_rgba(29,78,216,0.15)]"
                        : "bg-[#e7f9ef] text-admin-success border-[#bfe8d1] hover:shadow-[0_4px_10px_rgba(22,101,52,0.15)]"
                    } ${
                      String(user._id) === String(currentUserId)
                        ? "opacity-65 pointer-events-none hover:translate-y-0 hover:shadow-none"
                        : ""
                    }`}
                    onClick={() => String(user._id) !== String(currentUserId) && handleToggleRole(user)}
                    title={
                      String(user._id) === String(currentUserId)
                        ? "Không thể tự thay đổi vai trò của chính mình"
                        : "Click để thay đổi vai trò"
                    }
                  >
                    {user.role}
                  </span>
                </td>
                <td>{formatDateTime(user.createdAt)}</td>
                <td>
                  {editingUserId === user._id ? (
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(user._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#0f766e] border-[#99f6e4] bg-[#f0fdfa] hover:bg-[#ccfbf1] hover:border-[#5eead4] hover:text-[#0d9488]"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#475569] border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#94a3b8] hover:text-[#0f172a]"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => startEdit(user)}
                        title="Sửa thông tin"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#475569] border-[#cbd5e1] bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#94a3b8] hover:text-[#0f172a]"
                      >
                        <FontAwesomeIcon icon={faPen} /> Sửa
                      </button>
                      {user.role !== "admin" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditPoints(user)}
                            title="Điều chỉnh điểm tích lũy"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#0f766e] border-[#99f6e4] bg-[#f0fdfa] hover:bg-[#ccfbf1] hover:border-[#5eead4] hover:text-[#0d9488]"
                          >
                            <FontAwesomeIcon icon={faCoins} /> Điểm
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditPassword(user)}
                            title="Đặt lại mật khẩu"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#4338ca] border-[#c7d2fe] bg-[#eef2ff] hover:bg-[#e0e7ff] hover:border-[#a5b4fc] hover:text-[#4f46e5]"
                          >
                            <FontAwesomeIcon icon={faKey} /> Mật khẩu
                          </button>
                        </>
                      )}
                      {String(user._id) === String(currentUserId) ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#b91c1c] border-[#fca5a5] bg-[#fef2f2] opacity-70 cursor-not-allowed"
                          disabled
                        >
                          Hiện tại
                        </button>
                      ) : user.role === "admin" ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#b91c1c] border-[#fca5a5] bg-[#fef2f2] opacity-70 cursor-not-allowed"
                          disabled
                        >
                          Admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold text-xs transition-colors duration-150 text-[#b91c1c] border-[#fca5a5] bg-[#fef2f2] hover:bg-[#fee2e2] hover:border-[#f87171] hover:text-[#991b1b]"
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
                <td colSpan="6" className="text-center! text-admin-muted p-6!">
                  Không có dữ liệu ở nhóm này.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );

  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section
        className="bg-admin-surface border border-admin-line rounded-3xl shadow-admin p-6 md:p-8 grid gap-4 animate-admin-rise bg-[radial-gradient(circle_at_88%_-8%,rgba(255,111,60,0.12),transparent_36%),radial-gradient(circle_at_-8%_100%,rgba(15,118,110,0.1),transparent_30%),#ffffff]"
        aria-busy={loading || deleting}
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-admin-ink mt-0 mb-1">Quản lý người dùng</h2>
          <p className="text-admin-muted mt-1.5 mb-0 text-sm md:text-base">Theo dõi tài khoản, phân quyền và cập nhật thông tin người dùng trong hệ thống.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-2" aria-label="Thống kê người dùng">
          <article className="border border-[#dbe6f3] rounded-xl bg-white p-3 grid gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <span className="text-[10px] text-admin-muted font-bold uppercase tracking-wider">Tổng tài khoản</span>
            <strong className="text-admin-ink text-2xl font-extrabold leading-none">{totalUsers}</strong>
          </article>
          <article className="border border-[#dbe6f3] rounded-xl bg-white p-3 grid gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <span className="text-[10px] text-admin-muted font-bold uppercase tracking-wider">Admin</span>
            <strong className="text-blue-700 text-2xl font-extrabold leading-none">{totalAdmins}</strong>
          </article>
          <article className="border border-[#dbe6f3] rounded-xl bg-white p-3 grid gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <span className="text-[10px] text-admin-muted font-bold uppercase tracking-wider">Người dùng</span>
            <strong className="text-admin-success text-2xl font-extrabold leading-none">{totalCustomers}</strong>
          </article>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.7fr_1fr] gap-3 mt-1 mb-2">
          <div className="grid gap-1.5">
            <label htmlFor="users-search" className="text-admin-muted text-xs font-bold uppercase tracking-wider">Tìm kiếm</label>
            <input
              id="users-search"
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
            />
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="users-sort" className="text-admin-muted text-xs font-bold uppercase tracking-wider">Sắp xếp</label>
            <select
              id="users-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="name-asc">Tên A-Z</option>
              <option value="name-desc">Tên Z-A</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-admin-muted py-6 text-center font-medium">Đang tải danh sách người dùng...</p>
        ) : (
          <>
            {renderUsersTable("Tài khoản Admin", "Danh sách tài khoản có quyền quản trị hệ thống.", filteredAdmins)}
            {renderUsersTable("Tài khoản Người dùng", "Danh sách tài khoản khách hàng đang hoạt động.", paginatedCustomers)}
            {filteredCustomers.length > 0 && (
              <div className="mt-3.5 p-3 flex flex-col sm:flex-row justify-between items-center gap-3 border border-[#dce5f0] rounded-xl bg-[#f8fbff]">
                <p className="m-0 text-[#4f6078] text-[13px] font-bold">
                  Hiển thị <strong>{paginatedCustomers.length}</strong> / {filteredCustomers.length} khách hàng
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                    Trước
                  </button>
                  <span className="text-[#4f6078] text-[13px] font-semibold">
                    Trang {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-[rgba(9,17,27,0.5)] flex items-center justify-center z-50 p-4" role="presentation">
          <div className="w-full max-w-[460px] bg-white rounded-2xl p-5 shadow-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
            <h3 id="delete-user-title" className="m-0 mb-2 text-lg font-bold text-admin-ink">Xác nhận xóa người dùng</h3>
            <p className="m-0 mb-4 text-sm text-admin-muted">
              Bạn có chắc chắn muốn xóa tài khoản <strong>{userPendingDelete.email}</strong>?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] font-bold text-sm cursor-pointer transition-colors duration-150 hover:bg-[#eef4fb]"
                onClick={() => setUserPendingDelete(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-red-700 text-white font-bold text-sm cursor-pointer transition-colors duration-150 hover:bg-red-800"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thay Đổi Điểm */}
      {userPendingPoints && (
        <div className="fixed inset-0 bg-[rgba(9,17,27,0.5)] flex items-center justify-center z-50 p-4" role="presentation">
          <div className="w-full max-w-[500px] bg-white rounded-2xl p-5 shadow-modal" role="dialog" aria-modal="true" aria-labelledby="points-modal-title">
            <h3 id="points-modal-title" className="m-0 mb-1 text-lg font-bold text-admin-ink">
              Điều chỉnh điểm tích lũy
            </h3>
            <p className="m-0 mb-4 text-sm text-admin-muted">
              Cập nhật điểm thưởng cho tài khoản: <strong>{userPendingPoints.email}</strong>
            </p>

            <div className="grid gap-3.5 mb-5">
              <div className="flex justify-between items-center bg-[#f8fbff] p-3 border border-[#dde7f4] rounded-xl">
                <span className="text-admin-muted text-xs font-bold uppercase tracking-wider">Điểm hiện tại</span>
                <span className="text-base font-bold text-admin-ink">
                  {(userPendingPoints.loyaltyPoints || 0).toLocaleString("vi-VN")} điểm
                </span>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="new-points-input" className="text-admin-muted text-xs font-bold uppercase tracking-wider">
                  Điểm mới
                </label>
                <input
                  id="new-points-input"
                  type="number"
                  min="0"
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                  placeholder="Nhập số điểm mới..."
                  value={newPoints}
                  onChange={(e) => setNewPoints(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="points-reason-input" className="text-admin-muted text-xs font-bold uppercase tracking-wider">
                  Lý do thay đổi
                </label>
                <textarea
                  id="points-reason-input"
                  rows="3"
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] resize-y"
                  placeholder="Nhập lý do điều chỉnh điểm (ví dụ: Tặng điểm sinh nhật, sửa lỗi giao dịch...)"
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] font-bold text-sm cursor-pointer transition-colors duration-150 hover:bg-[#eef4fb]"
                onClick={() => setUserPendingPoints(null)}
                disabled={updatingPoints}
              >
                Hủy
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-admin-primary text-white font-bold text-sm cursor-pointer transition-colors duration-150 hover:bg-teal-800"
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
        <div className="fixed inset-0 bg-[rgba(9,17,27,0.5)] flex items-center justify-center z-50 p-4" role="presentation">
          <div className="w-full max-w-[500px] bg-white rounded-2xl p-5 shadow-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
            <h3 id="password-modal-title" className="m-0 mb-1 text-lg font-bold text-admin-ink">
              Thay đổi mật khẩu người dùng
            </h3>
            <p className="m-0 mb-4 text-sm text-admin-muted">
              Đặt lại mật khẩu cho tài khoản: <strong>{userPendingPassword.email}</strong>
            </p>

            <div className="grid gap-3.5 mb-5">
              <div className="grid gap-1.5">
                <label htmlFor="new-password-input" className="text-admin-muted text-xs font-bold uppercase tracking-wider">
                  Mật khẩu mới
                </label>
                <input
                  id="new-password-input"
                  type="password"
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="confirm-password-input" className="text-admin-muted text-xs font-bold uppercase tracking-wider">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="confirm-password-input"
                  type="password"
                  className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                  placeholder="Nhập lại mật khẩu mới để xác nhận..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] font-bold text-sm cursor-pointer transition-colors duration-150 hover:bg-[#eef4fb]"
                onClick={() => setUserPendingPassword(null)}
                disabled={updatingPassword}
              >
                Hủy
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm cursor-pointer transition-colors duration-150"
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
        <div className="fixed inset-0 bg-[rgba(9,17,27,0.5)] flex items-center justify-center z-50 p-4" role="presentation">
          <div className="w-full max-w-[500px] bg-white rounded-2xl p-5 shadow-modal" role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
            <h3 id="role-modal-title" className="m-0 mb-1 text-lg font-bold text-admin-ink">
              {newRolePending === "admin" ? "Nâng quyền lên Quản trị viên" : "Hạ quyền thành Khách hàng"}
            </h3>
            <p className="m-0 mb-4 text-sm text-admin-muted">
              Thay đổi vai trò cho tài khoản: <strong>{userPendingRoleChange.email}</strong>
            </p>

            <div className="grid gap-3.5 mb-4">
              <div className="flex justify-between items-center bg-[#f8fbff] p-3 border border-[#dde7f4] rounded-xl">
                <span className="text-admin-muted text-xs font-bold uppercase tracking-wider">Vai trò hiện tại</span>
                <span className="text-base font-bold text-admin-ink capitalize">
                  {userPendingRoleChange.role}
                </span>
              </div>

              <div className="flex justify-between items-center bg-[#f8fbff] p-3 border border-[#dde7f4] rounded-xl">
                <span className="text-admin-muted text-xs font-bold uppercase tracking-wider">Vai trò mới</span>
                <span className="text-base font-bold capitalize" style={{ color: newRolePending === "admin" ? "#1d4ed8" : "#166534" }}>
                  {newRolePending}
                </span>
              </div>

              {newRolePending === "admin" && (
                <div className="grid gap-1.5">
                  <label htmlFor="admin-pass-role-input" className="text-admin-muted text-xs font-bold uppercase tracking-wider">
                    Xác nhận mật khẩu của bạn (Admin)
                  </label>
                  <input
                    id="admin-pass-role-input"
                    type="password"
                    className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
                    placeholder="Nhập mật khẩu của bạn để xác nhận..."
                    value={adminPasswordForRole}
                    onChange={(e) => setAdminPasswordForRole(e.target.value)}
                  />
                </div>
              )}
            </div>

            <p className="text-xs text-admin-muted mt-2 mb-4 leading-relaxed">
              {newRolePending === "admin"
                ? "Lưu ý: Tài khoản Quản trị viên sẽ có đầy đủ quyền thay đổi cấu hình hệ thống."
                : "Bạn có chắc chắn muốn hạ quyền của tài khoản quản trị viên này?"
              }
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] font-bold text-sm cursor-pointer transition-colors duration-150 hover:bg-[#eef4fb]"
                onClick={() => setUserPendingRoleChange(null)}
                disabled={updatingRole}
              >
                Hủy
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-xl font-bold text-sm cursor-pointer transition-colors duration-150 ${newRolePending === "admin" ? "bg-indigo-700 hover:bg-indigo-800 text-white border-transparent" : "bg-red-700 hover:bg-red-800 text-white border-transparent"}`}
                onClick={handleSaveRoleChange}
                disabled={updatingRole}
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

