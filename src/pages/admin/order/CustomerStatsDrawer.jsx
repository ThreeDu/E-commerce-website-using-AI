import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faUser, faEnvelope, faCoins, faGift, faExternalLink } from "@fortawesome/free-solid-svg-icons";
import { formatCurrency, formatDateTime } from "../../../utils/formatUtils";
import { getStatusInfo } from "../../../utils/orderStatusUtils";

function CustomerStatsDrawer({ creatingVoucher, customerStats, handleCreateVoucher, handleUpdatePoints, handleViewOrderDetail, isDrawerOpen, pointsReason, pointsValue, setIsDrawerOpen, setPointsReason, setPointsValue, setVoucherCode, setVoucherExpiry, setVoucherMaxDiscount, setVoucherMinOrder, setVoucherValue, statsError, statsLoading, updatingPoints, voucherCode, voucherExpiry, voucherMaxDiscount, voucherMinOrder, voucherValue }) {
  if (!isDrawerOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 transition-opacity duration-300" 
        onClick={() => setIsDrawerOpen(false)}
      />

      {/* Drawer Panel */}
      <div 
        className="relative w-full max-w-[620px] max-h-[85vh] bg-white border border-slate-200 shadow-2xl flex flex-col rounded-3xl z-10 overflow-hidden animate-slide-up"
      >

          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <FontAwesomeIcon icon={faUser} />
              </div>
              <div>
                <h3 className="m-0 text-base font-bold text-slate-800">Thống kê & Lịch sử</h3>
                <p className="m-0 text-xs text-slate-500 font-medium">Chi tiết thông tin khách hàng và lịch sử đơn hàng</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
            {statsLoading ? (
              <div className="py-20 text-center text-slate-500 font-medium space-y-2">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Đang tải dữ liệu thống kê khách hàng...</p>
              </div>
            ) : statsError ? (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                {statsError}
              </div>
            ) : customerStats ? (
              <>
                {/* User profile brief card */}
                <div className="p-4 bg-gradient-to-br from-indigo-50/40 to-slate-50/40 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 text-base truncate">{customerStats.user?.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 truncate">
                      <FontAwesomeIcon icon={faEnvelope} /> {customerStats.user?.email}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2 font-medium">
                      Gia nhập: {new Date(customerStats.user?.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Hạng thành viên</div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1.5 border ${
                      customerStats.rank === "Kim Cương" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      customerStats.rank === "Vàng" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      customerStats.rank === "Bạc" ? "bg-slate-100 text-slate-700 border-slate-300" :
                      "bg-orange-50 text-orange-700 border-orange-200"
                    }`}>
                      {customerStats.rank}
                    </span>
                  </div>
                </div>

                {/* User activity metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 bg-slate-50/50 border border-slate-200/60 rounded-xl p-3 shadow-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Truy cập gần nhất</span>
                    <strong className="text-slate-700 block font-semibold">
                      {customerStats.lastVisit ? formatDateTime(customerStats.lastVisit) : "Chưa ghi nhận"}
                    </strong>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Đặt hàng gần nhất</span>
                    <strong className="text-slate-700 block font-semibold">
                      {customerStats.lastOrderDate ? formatDateTime(customerStats.lastOrderDate) : "Chưa có đơn hàng"}
                    </strong>
                  </div>
                  {customerStats.lastPurchaseDate && customerStats.lastPurchaseDate !== customerStats.lastOrderDate && (
                    <div className="col-span-2 pt-2 border-t border-slate-100 space-y-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Mua thành công gần nhất</span>
                      <strong className="text-emerald-600 block font-semibold">
                        {formatDateTime(customerStats.lastPurchaseDate)}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Stats metric cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Truy cập tuần</span>
                    <strong className="text-slate-800 text-xl font-black">{customerStats.weeklyVisits}</strong>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tổng chi tiêu</span>
                    <strong className="text-red-600 text-[15px] font-black truncate">{formatCurrency(customerStats.totalSpent)}</strong>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col gap-1 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Đơn hàng</span>
                    <strong className="text-slate-800 text-xl font-black">{customerStats.totalOrders}</strong>
                  </div>
                </div>

                {/* Quick Voucher Creator */}
                <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-4">
                  <div className="flex items-center gap-1.5 text-indigo-600">
                    <FontAwesomeIcon icon={faGift} className="text-sm" />
                    <h4 className="m-0 text-sm font-bold text-slate-800">Tặng Voucher khuyến khích mua sắm</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="grid gap-1">
                      <label className="text-slate-500 font-bold uppercase tracking-wider">Phần trăm giảm (%)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="100" 
                        value={voucherValue}
                        onChange={(e) => setVoucherValue(e.target.value)}
                        className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-slate-500 font-bold uppercase tracking-wider">Hạn sử dụng (Ngày)</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={voucherExpiry}
                        onChange={(e) => setVoucherExpiry(e.target.value)}
                        className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-slate-500 font-bold uppercase tracking-wider">Giảm tối đa (đ)</label>
                      <input 
                        type="number" 
                        min="0" 
                        value={voucherMaxDiscount}
                        onChange={(e) => setVoucherMaxDiscount(e.target.value)}
                        className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                        placeholder="0 = Không giới hạn"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-slate-500 font-bold uppercase tracking-wider">Đơn tối thiểu (đ)</label>
                      <input 
                        type="number" 
                        min="0" 
                        value={voucherMinOrder}
                        onChange={(e) => setVoucherMinOrder(e.target.value)}
                        className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1 text-xs">
                    <label className="text-slate-500 font-bold uppercase tracking-wider">Mã Voucher (Tùy chọn)</label>
                    <input 
                      type="text" 
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      placeholder="Mặc định: Tự sinh mã ngẫu nhiên"
                      className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500 uppercase"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateVoucher}
                    disabled={creatingVoucher}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {creatingVoucher ? "Đang tạo..." : "Tạo và gửi Voucher"}
                  </button>
                </div>

                {/* Points Adjustment tool */}
                <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-4">
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <FontAwesomeIcon icon={faCoins} className="text-sm" />
                    <h4 className="m-0 text-sm font-bold text-slate-800">Điều chỉnh điểm tích lũy</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="grid gap-1">
                      <label className="text-slate-500 font-bold uppercase tracking-wider">Tổng số điểm mới</label>
                      <input 
                        type="number" 
                        min="0" 
                        value={pointsValue}
                        onChange={(e) => setPointsValue(e.target.value)}
                        className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-slate-500 font-bold uppercase tracking-wider">Lý do điều chỉnh</label>
                      <input 
                        type="text" 
                        value={pointsReason}
                        onChange={(e) => setPointsReason(e.target.value)}
                        placeholder="Nhập lý do điều chỉnh..."
                        className="border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUpdatePoints}
                    disabled={updatingPoints}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {updatingPoints ? "Đang cập nhật..." : "Cập nhật số điểm"}
                  </button>
                </div>

                {/* Order History Table */}
                <div className="space-y-3">
                  <h4 className="m-0 text-sm font-bold text-slate-800">Lịch sử đơn hàng của khách hàng</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs table-fixed">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                        <tr className="text-slate-500 [&>th]:p-2 [&>th]:font-bold [&>th]:text-[10px] [&>th]:uppercase">
                          <th className="w-[35%]">Mã đơn</th>
                          <th className="w-[35%]">Tổng tiền</th>
                          <th className="w-[30%]">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customerStats.orders.map((o) => (
                          <tr 
                            key={o._id} 
                            className="hover:bg-slate-50/80 cursor-pointer [&>td]:p-2.5"
                            onClick={() => {
                              handleViewOrderDetail(o._id);
                            }}
                            title="Bấm để xem chi tiết đơn hàng này"
                          >
                            <td className="font-mono font-bold text-indigo-600 truncate">
                              <FontAwesomeIcon icon={faExternalLink} className="mr-1 text-[10px]" />
                              {o._id}
                            </td>
                            <td className="font-bold text-slate-700">{formatCurrency(o.totalPrice)}</td>
                            <td>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                o.status === "delivered" ? "bg-green-50 text-green-700 border border-green-200" :
                                o.status === "cancelled" ? "bg-red-50 text-red-700 border border-red-200" :
                                o.status === "shipping" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}>
                                {getStatusInfo(o).label}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {customerStats.orders.length === 0 && (
                          <tr>
                            <td colSpan="3" className="text-center text-slate-400 py-6">
                              Chưa có đơn hàng nào được đặt.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
  );
}

export default CustomerStatsDrawer;
