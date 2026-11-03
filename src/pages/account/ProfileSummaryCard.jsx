import AvatarEditor from "../../components/common/AvatarEditor";

function ProfileSummaryCard({ auth, avatar, error, login, memberSince, metrics, scrollToEditForm, setAvatar, setIsRedeemModalOpen, success }) {
  return (
    <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col">
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_200px] gap-6 items-start border-b border-[#f1f5f9] pb-6 mb-6">
        <div className="flex justify-center shrink-0">
          <AvatarEditor
            currentAvatar={avatar}
            userName={auth?.user?.name}
            token={auth?.token}
            onAvatarUpdated={(user) => {
              setAvatar(user.avatar);
              login({ token: auth.token, user });
            }}
            showError={error}
            showSuccess={success}
            compact={true}
          />
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[11px] font-bold text-[#6366f1] uppercase tracking-wider block mb-1">TỔNG QUAN TÀI KHOẢN</span>
          <h1 className="text-2xl font-black text-[#1e293b] m-0 mb-5 leading-tight">{auth?.user?.name || "Người dùng"}</h1>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-[480px]:grid-cols-1 text-left">
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">EMAIL</span>
              <span className="text-sm font-semibold text-[#1e293b] block break-all leading-normal">{auth?.user?.email || "Chưa cập nhật"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">SỐ ĐIỆN THOẠI</span>
              <span className="text-sm font-semibold text-[#1e293b] block leading-normal">{auth?.user?.phone || "Chưa cập nhật"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">ĐỊA CHỈ</span>
              <span className="text-sm font-semibold text-[#1e293b] block leading-snug">{auth?.user?.address || "Chưa cập nhật"}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-0.5">NGÀY THAM GIA</span>
              <span className="text-sm font-semibold text-[#1e293b] block leading-normal">{memberSince || "Đang cập nhật"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 self-center">
          <div className="bg-[#f8fafc] border border-[#f1f5f9] p-3.5 rounded-2xl flex flex-col hover:bg-[#f1f5f9] transition-all" style={{ cursor: "pointer" }} onClick={() => setIsRedeemModalOpen(true)}>
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">ĐIỂM TÍCH LŨY</span>
            <span className="text-2xl font-black text-[#1e293b] mt-0.5">{metrics.points.toLocaleString("vi-VN")}</span>
          </div>
          <div className="bg-[#eff6ff] border border-[#dbeafe] p-3.5 rounded-2xl flex flex-col">
            <span className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-wider">TRẠNG THÁI</span>
            <span className="text-sm font-black text-[#2563eb] mt-1">Hoạt động</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_200px] gap-6">
        <div className="hidden md:block"></div>
        <div className="text-left">
          <button type="button" className="py-2.5 px-8 bg-[#3b82f6] text-white border-none rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer transition-all hover:bg-blue-600 hover:-translate-y-0.5 shadow-sm hover:shadow-[0_4px_12px_rgba(59,130,246,0.35)]" onClick={scrollToEditForm}>
            Chỉnh sửa thông tin
          </button>
        </div>
        <div className="hidden md:block"></div>
      </div>
    </article>
  );
}

export default ProfileSummaryCard;
