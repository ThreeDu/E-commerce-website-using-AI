function IconSupport() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 2a10 10 0 0 0-10 10v4a2 2 0 0 0 2 2h1v-5H4v-1a8 8 0 0 1 16 0v1h-1v5h1a2 2 0 0 0 2-2v-4A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

function DashboardSidebar({ activeMenu, auth, avatar, handleMenuAction, sidebarItems }) {
  return (
    <aside className="sticky top-6 h-fit bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#e2e8f0] flex flex-col gap-4">
      <div className="flex items-center gap-4 py-3 border-b border-[#f3f4f6] mb-2">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ddd6fe] to-[#bfdbfe] flex items-center justify-center shrink-0 overflow-hidden border-2 border-[#e5e7eb]">
          {avatar ? (
            <img src={avatar} alt={auth?.user?.name || "Avatar"} className="w-full h-full object-cover rounded-full" />
          ) : (
            <span className="text-xl font-bold text-profile-primary">{String(auth?.user?.name || "A").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#1f2937] m-0 leading-tight truncate">{auth?.user?.name || "Người dùng"}</h2>
          <p className="text-xs text-[#9ca3af] m-0 leading-tight break-all truncate mt-0.5">{auth?.user?.email}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5" aria-label="Menu hồ sơ">
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`flex items-center gap-3.5 py-3.5 px-4 bg-transparent border-none rounded-xl cursor-pointer text-sm font-medium transition-all text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b] text-left ${
              item.danger
                ? "text-[#ef4444] hover:bg-[#ef4444]/10"
                : ""
            } ${
              activeMenu === item.key
                ? item.danger
                  ? "bg-[#ef4444]/15 text-[#ef4444] font-semibold"
                  : "bg-[#f5f3ff] text-[#4f46e5] font-semibold"
                : ""
            }`}
            onClick={() => handleMenuAction(item.key)}
          >
            <span className="w-5 h-5 flex items-center justify-center text-inherit">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4.5 bg-gradient-to-br from-[#eff6ff] to-[#f4f7ff] border border-[#dbeafe] rounded-2xl mt-2 flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 text-[#2563eb] flex items-center justify-center"><IconSupport /></span>
          <strong className="text-xs font-bold text-[#1e2937] uppercase tracking-wider">Hỗ trợ</strong>
        </div>
        <p className="text-xs text-[#64748b] leading-relaxed m-0">Nhận tư vấn về đơn hàng, đổi trả và bảo hành từ đội ngũ chăm sóc khách hàng.</p>
        <a href="mailto:support@shop.com" className="text-xs text-[#2563eb] no-underline font-bold hover:underline">support@shop.com</a>
      </div>
    </aside>
  );
}

export default DashboardSidebar;
