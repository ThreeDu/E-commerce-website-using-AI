import Modal from "../../../components/common/Modal";

function UserRoleModal({ adminPasswordForRole, handleSaveRoleChange, newRolePending, setAdminPasswordForRole, setUserPendingRoleChange, updatingRole, userPendingRoleChange }) {
  if (!userPendingRoleChange) {
    return null;
  }

  return (
    <Modal>
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
    </Modal>
  );
}

export default UserRoleModal;
