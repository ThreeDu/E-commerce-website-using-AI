import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faReceipt, faTimes } from "@fortawesome/free-solid-svg-icons";
import { getStatusInfo } from "../../../utils/orderStatusUtils";
import { formatCurrency, formatDateTime } from "../../../utils/formatUtils";
import { getProductImageSrc } from "../../../utils/productUtils";

function OrderDetailDrawer({ isOrderDrawerOpen, orderDetail, orderDetailError, orderDetailLoading, selectedOrderId, setIsOrderDrawerOpen }) {
  if (!isOrderDrawerOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 transition-opacity duration-300" 
        onClick={() => setIsOrderDrawerOpen(false)}
      />

      {/* Drawer Panel */}
      <div 
        className="relative w-full max-w-[620px] max-h-[85vh] bg-white border border-slate-200 shadow-2xl flex flex-col rounded-3xl z-10 overflow-hidden animate-slide-up"
      >
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <FontAwesomeIcon icon={faReceipt} />
              </div>
              <div>
                <h3 className="m-0 text-base font-bold text-slate-800">Chi tiết đơn hàng</h3>
                <p className="m-0 text-xs text-slate-500 font-medium">Mã đơn: {selectedOrderId}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOrderDrawerOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
            {orderDetailLoading ? (
              <div className="py-20 text-center text-slate-500 font-medium space-y-2">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p>Đang tải chi tiết đơn hàng...</p>
              </div>
            ) : orderDetailError ? (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                {orderDetailError}
              </div>
            ) : orderDetail ? (
              <>
                {/* Status and Overview */}
                {(() => {
                  const statusInfo = getStatusInfo(orderDetail);
                  return (
                    <div className="p-4 bg-gradient-to-br from-emerald-50/40 to-slate-50/40 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Trạng thái</div>
                        <span 
                          className="inline-flex items-center py-1 px-2.5 rounded-full font-bold text-xs mt-1.5"
                          style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tổng thanh toán</div>
                        <div className="text-xl font-black text-red-600 mt-1">{formatCurrency(orderDetail.totalPrice)}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Customer Info */}
                <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-3">
                  <h4 className="m-0 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Thông tin giao hàng</h4>
                  <div className="grid gap-2.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Người nhận:</span>
                      <strong className="text-slate-800">{orderDetail.shippingAddress?.fullName || "-"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Số điện thoại:</span>
                      <strong className="text-slate-800">{orderDetail.shippingAddress?.phone || "-"}</strong>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-medium">Địa chỉ nhận hàng:</span>
                      <strong className="text-slate-800 block text-left mt-0.5">{orderDetail.shippingAddress?.address || "-"}</strong>
                    </div>
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-3">
                  <h4 className="m-0 text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Thông tin đơn hàng</h4>
                  <div className="grid gap-2.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Ngày đặt hàng:</span>
                      <strong className="text-slate-800">{formatDateTime(orderDetail.createdAt)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Phương thức thanh toán:</span>
                      <strong className="text-slate-800">
                        {orderDetail.paymentMethod === "transfer"
                          ? "Chuyển khoản (Thủ công)"
                          : orderDetail.paymentMethod === "beepay"
                          ? "Quét mã VietQR (Tự động qua BeePay)"
                          : "Thanh toán khi nhận hàng (COD)"}
                      </strong>
                    </div>
                    {orderDetail.discountCode && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Mã giảm giá đã dùng:</span>
                        <strong className="text-emerald-600 font-bold">{orderDetail.discountCode}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Products list */}
                <div className="space-y-3">
                  <h4 className="m-0 text-sm font-bold text-slate-800">Sản phẩm trong đơn</h4>
                  <div className="space-y-2.5">
                    {(orderDetail.orderItems || []).map((item, idx) => {
                      const product = item.product || {};
                      return (
                        <div key={`${product._id || idx}-${idx}`} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3 bg-white hover:bg-slate-50/50 transition-colors">
                          <img 
                            src={getProductImageSrc(product)} 
                            alt={item.name} 
                            className="w-14 h-14 object-cover rounded-lg bg-slate-50 shrink-0 border border-slate-100"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "/placeholder.svg";
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-800 block truncate leading-snug">{item.name}</span>
                            <span className="text-[11px] text-slate-400 font-medium block mt-1">
                              Số lượng: {item.quantity} • Đơn giá: {formatCurrency(item.price)}
                            </span>
                          </div>
                          <span className="text-xs font-black text-slate-800 shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="border border-slate-200/80 rounded-2xl p-4 bg-white space-y-3 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Tạm tính:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(orderDetail.subtotalPrice || orderDetail.totalPrice || 0)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Giảm giá:</span>
                    <span className="font-semibold text-emerald-600">- {formatCurrency(orderDetail.discountAmount || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-100 pt-3">
                    <span>Tổng cộng:</span>
                    <span className="text-red-600 text-base">{formatCurrency(orderDetail.totalPrice)}</span>
                  </div>
                </div>

                {/* Cancellation Reason if cancelled */}
                {orderDetail.status === "cancelled" && orderDetail.cancelledReason && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                    <span className="font-bold block mb-1">Lý do hủy đơn:</span>
                    {orderDetail.cancelledReason}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
  );
}

export default OrderDetailDrawer;
