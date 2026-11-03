import Modal from "../../../components/common/Modal";

function UserPasswordModal({ confirmPassword, handleSavePassword, newPassword, setConfirmPassword, setNewPassword, setUserPendingPassword, updatingPassword, userPendingPassword }) {
  if (!userPendingPassword) {
    return null;
  }

  return (
    <Modal>
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
    </Modal>
  );
}

export default UserPasswordModal;
