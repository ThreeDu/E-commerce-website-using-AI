function ProfileEditForm({ formData, handleChange, handleSubmit, memberSince, profileEditRef, profileErrors, setIsPasswordModalOpen }) {
  return (
    <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col" ref={profileEditRef}>
      <div className="flex justify-between items-center p-6 border-b border-[#f3f4f6]">
        <h3 className="m-0 text-lg font-bold text-[#1f2937]">Chỉnh sửa thông tin</h3>
        <button type="button" className="text-xs font-semibold text-profile-primary no-underline hover:underline" onClick={() => setIsPasswordModalOpen(true)}>
          Đổi mật khẩu
        </button>
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Họ và tên</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nhập họ và tên"
              className={`w-full p-3.5 rounded-xl border bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all ${
                profileErrors.name ? "border-red-400 focus:ring-red-450" : "border-[#cbd5e1]"
              }`}
            />
            {profileErrors.name && (
              <span className="text-red-500 text-xs font-semibold pl-1 mt-0.5 animate-fade-in">
                {profileErrors.name}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Số điện thoại</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Nhập số điện thoại"
              className="w-full p-3.5 rounded-xl border border-[#cbd5e1] bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 max-[680px]:grid-cols-1">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Địa chỉ</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows="4"
              placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện..."
              className="w-full p-3.5 rounded-xl border border-[#cbd5e1] bg-white text-[#1f2937] text-sm focus:outline-none focus:ring-2 focus:ring-profile-primary transition-all"
            />
          </div>
          <div className="flex flex-col gap-2 content-start">
            <label className="text-xs font-bold text-[#1f2937] uppercase tracking-wider">Ngày tham gia</label>
            <div className="min-h-12 flex items-center px-3.5 py-3 rounded-[14px] bg-gradient-to-br from-[#f8fafc] to-[#eef2ff] border border-[#e5e7eb] text-[#0f172a] font-bold">
              {memberSince}
            </div>
            <p className="m-0 text-[#64748b] text-[0.88rem] leading-relaxed">
              Avatar có thể đổi trực tiếp bằng biểu tượng camera trên ảnh đại diện.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3.5 mt-4">
          <button type="submit" className="py-3.5 px-6 font-bold rounded-xl text-sm transition-all cursor-pointer bg-profile-primary text-white hover:bg-profile-primary-light hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
            Lưu thay đổi
          </button>
        </div>
      </form>
    </article>
  );
}

export default ProfileEditForm;
