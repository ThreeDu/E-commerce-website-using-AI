import { Link } from "react-router-dom";
import { formatPrice, parsePrice } from "../../utils/priceUtils";
import { getStatusInfo } from "../../utils/orderStatusUtils";

function normalizeImageSrc(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "/placeholder.svg";
  }

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:image/") ||
    raw.startsWith("/")
  ) {
    return raw;
  }

  return `/${raw.replace(/^\/+/, "")}`;
}

function WishlistOrdersSection({ handleRemoveWishlistItem, isWishlistLoading, navigate, recentOrders, wishlist, wishlistPreview }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-[#f1f5f9] mb-4">
          <h3 className="m-0 text-sm font-bold text-[#1f2937]">Danh sách yêu thích</h3>
          {wishlist.length > 3 && (
            <Link to="/wishlist" className="text-xs font-semibold text-[#6366f1] no-underline hover:underline">
              Xem tất cả ({wishlist.length})
            </Link>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {isWishlistLoading ? (
            <p className="text-center py-6 text-[#6b7280] text-sm col-span-3">Đang tải danh sách yêu thích...</p>
          ) : wishlistPreview.length === 0 ? (
            <p className="text-center py-6 text-[#6b7280] text-sm col-span-3">Chưa có sản phẩm yêu thích.</p>
          ) : (
            wishlistPreview.map((item) => (
              <article key={item._id} className="flex flex-col gap-2 relative bg-white border border-[#f1f5f9] rounded-2xl overflow-hidden p-2.5 group hover:border-[#cbd5e1] hover:shadow-sm transition-all text-center">
                <div className="w-full aspect-square rounded-xl bg-[#f8fafc] relative overflow-hidden flex items-center justify-center">
                  <img
                    src={normalizeImageSrc(item.image)}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-xl transition-transform group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = "/placeholder.svg";
                    }}
                  />
                  <button 
                    type="button" 
                    className="absolute top-2 right-2 w-6.5 h-6.5 rounded-full bg-white flex items-center justify-center border border-[#e5e7eb] cursor-pointer text-[#ef4444] shadow-sm hover:scale-110 transition-transform" 
                    onClick={() => handleRemoveWishlistItem(item._id)}
                    aria-label="Xóa khỏi yêu thích"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5A5.49 5.49 0 0 1 7.5 3 6.1 6.1 0 0 1 12 5.09 6.1 6.1 0 0 1 16.5 3 5.49 5.49 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.53L12 21.35Z" /></svg>
                  </button>
                </div>
                <div className="flex flex-col min-w-0">
                  <h4 className="text-[11px] font-semibold text-[#1e293b] line-clamp-2 h-8 m-0 leading-snug">{item.name}</h4>
                  <p className="text-[13px] font-bold text-[#2563eb] mt-1">{formatPrice(parsePrice(item.finalPrice || item.price || 0))}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </article>

      <article className="bg-white rounded-3xl p-6 border border-[#e2e8f0] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col">
        <div className="flex justify-between items-center pb-3 border-b border-[#f1f5f9] mb-4">
          <h3 className="m-0 text-sm font-bold text-[#1f2937]">Đơn hàng gần đây</h3>
          <button type="button" onClick={() => navigate("/order-history")} className="text-xs font-semibold text-[#6366f1] border-none bg-transparent cursor-pointer no-underline hover:underline">
            Xem tất cả
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {recentOrders.length === 0 ? (
            <p className="text-center py-6 text-[#6b7280] text-sm">Chưa có đơn hàng gần đây.</p>
          ) : (
            recentOrders.map((order) => (
              <div key={order._id} className="flex justify-between items-center p-3 border border-[#f1f5f9] rounded-2xl hover:border-[#cbd5e1] hover:bg-[#f8fafc] transition-all" style={{ cursor: "pointer" }} onClick={() => navigate(`/order-history/${order._id}`)}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-sm text-[#1e293b]">#{String(order._id).slice(-8)}</span>
                  <span className="text-[11px] text-[#94a3b8]">{new Date(order.createdAt).toLocaleDateString("vi-VN")}</span>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                  order.status === "delivered" ? "bg-[#f0fdf4] text-[#16a34a] border-[#dcfce7]" :
                  order.status === "shipping" ? "bg-[#ecfdf5] text-[#059669] border-[#d1fae5]" :
                  order.status === "confirmed" ? "bg-[#eff6ff] text-[#2563eb] border-[#dbeafe]" :
                  order.status === "cancelled" ? "bg-[#fef2f2] text-[#dc2626] border-[#fee2e2]" :
                  "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]" // pending
                }`}>
                  {getStatusInfo(order).label.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

export default WishlistOrdersSection;
