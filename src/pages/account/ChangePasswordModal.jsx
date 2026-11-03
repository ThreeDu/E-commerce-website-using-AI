function ChangePasswordModal({ handleChangePassword, handlePasswordChange, isPasswordModalOpen, passwordErrors, passwordForm, setIsPasswordModalOpen }) {
  if (!isPasswordModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-[9999] p-5">
      <div className="bg-white rounded-2xl w-full max-w-[500px] p-6 shadow-xl border border-[#e2e8f0] animate-fade-in">
        <div className="flex justify-between items-center p-6 border-b border-[#f1f5f9]">
          <h3 className="m-0 text-xl font-extrabold text-[#0f172a]">Đổi mật khẩu</h3>
          <button type="button" className="w-8 h-8 rounded bg-[#f1f5f9] border-none text-[#64748b] text-[1.2rem] cursor-pointer transition-all flex items-center justify-center hover:bg-[#e2e8f0] hover:text-[#0f172a]" onClick={() => setIsPasswordModalOpen(false)}>
            ✕
          </button>
        </div>
        <form onSubmit={handleChangePassword} className="p-6 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Mật khẩu hiện tại</label>
            <input
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              placeholder="Nhập mật khẩu hiện tại"
              className={`w-full p-3.5 rounded-xl border bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all ${
                passwordErrors.currentPassword ? "border-red-400 focus:ring-red-400/50" : "border-[#cbd5e1]"
              }`}
            />
            {passwordErrors.currentPassword && (
              <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                {passwordErrors.currentPassword}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Mật khẩu mới</label>
            <input
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              placeholder="Nhập mật khẩu mới"
              className={`w-full p-3.5 rounded-xl border bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all ${
                passwordErrors.newPassword ? "border-red-400 focus:ring-red-400/50" : "border-[#cbd5e1]"
              }`}
            />
            {passwordErrors.newPassword && (
              <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                {passwordErrors.newPassword}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              placeholder="Xác nhận mật khẩu mới"
              className={`w-full p-3.5 rounded-xl border bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all ${
                passwordErrors.confirmPassword ? "border-red-400 focus:ring-red-400/50" : "border-[#cbd5e1]"
              }`}
            />
            {passwordErrors.confirmPassword && (
              <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                {passwordErrors.confirmPassword}
              </span>
            )}
          </div>
          <div className="flex gap-3 justify-end mt-2">
            <button type="button" className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-[#f3f4f6] text-[#1f2937] border border-[#e5e7eb] hover:bg-[#e5e7eb]" onClick={() => setIsPasswordModalOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-profile-primary text-white hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
              Cập nhật mật khẩu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordModal;
