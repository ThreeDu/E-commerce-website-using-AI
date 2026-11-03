import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useStatusMessageBridge } from "../../../hooks/useStatusMessageBridge";
import {
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
  updateAdminUserPoints,
  updateAdminUserPassword,
} from "../../../services/admin/adminUserService";
import { getErrorMessage } from "../../../utils/adminErrorUtils";
import ConfirmDeleteModal from "../../../components/common/ConfirmDeleteModal";
import Pagination from "../../../components/common/Pagination";
import UserRoleModal from "./UserRoleModal";
import UserPasswordModal from "./UserPasswordModal";
import UserPointsModal from "./UserPointsModal";
import UsersTable from "./UsersTable";
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
    <UsersTable cancelEdit={cancelEdit} currentUserId={currentUserId} editForm={editForm} editingUserId={editingUserId} formatDateTime={formatDateTime} handleEditChange={handleEditChange} handleSaveEdit={handleSaveEdit} handleStartEditPassword={handleStartEditPassword} handleStartEditPoints={handleStartEditPoints} handleToggleRole={handleToggleRole} list={list} setUserPendingDelete={setUserPendingDelete} startEdit={startEdit} tableDescription={tableDescription} tableTitle={tableTitle} />
  );

  return (
    <main className="admin-page-container flex flex-col gap-6" aria-busy={loading || deleting}>
      <section className="admin-card p-6 md:p-8 flex flex-col gap-5">
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
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            )}
          </>
        )}
      </section>

      <ConfirmDeleteModal
        isOpen={Boolean(userPendingDelete)}
        title="Xác nhận xóa người dùng"
        message={<>Bạn có chắc chắn muốn xóa tài khoản <strong>{userPendingDelete?.email}</strong>?</>}
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setUserPendingDelete(null)}
        confirmLabel="Xóa"
        loadingLabel="Đang xóa..."
      />

      {/* Modal Thay Đổi Điểm */}
      <UserPointsModal handleSavePoints={handleSavePoints} newPoints={newPoints} pointsReason={pointsReason} setNewPoints={setNewPoints} setPointsReason={setPointsReason} setUserPendingPoints={setUserPendingPoints} updatingPoints={updatingPoints} userPendingPoints={userPendingPoints} />

      {/* Modal Thay Đổi Mật Khẩu */}
      <UserPasswordModal confirmPassword={confirmPassword} handleSavePassword={handleSavePassword} newPassword={newPassword} setConfirmPassword={setConfirmPassword} setNewPassword={setNewPassword} setUserPendingPassword={setUserPendingPassword} updatingPassword={updatingPassword} userPendingPassword={userPendingPassword} />
      {/* Modal Thay Đổi Vai Trò */}
      <UserRoleModal adminPasswordForRole={adminPasswordForRole} handleSaveRoleChange={handleSaveRoleChange} newRolePending={newRolePending} setAdminPasswordForRole={setAdminPasswordForRole} setUserPendingRoleChange={setUserPendingRoleChange} updatingRole={updatingRole} userPendingRoleChange={userPendingRoleChange} />
    </main>
  );
}

export default AdminUsersPage;

