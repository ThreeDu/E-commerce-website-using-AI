import { Link, useLocation } from "react-router-dom";

function Footer() {
  const location = useLocation();

  // Hide storefront footer on all admin portal routes
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer id="contact" className="mt-auto border-t border-slate-200/80 bg-white text-slate-600 text-sm">
      {/* ── 4 Cột Cam Kết Mua Sắm (Trust Pillars Bar) ── */}
      <div className="border-b border-slate-100 bg-slate-50/70 py-7">
        <div className="w-[min(1140px,92%)] mx-auto grid grid-cols-4 gap-6 max-[960px]:grid-cols-2 max-[540px]:grid-cols-1">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center text-lg shrink-0">
              🛡️
            </div>
            <div>
              <h4 className="m-0 text-sm font-bold text-slate-900">100% Chính hãng</h4>
              <p className="m-0 mt-0.5 text-xs text-slate-500 leading-relaxed">Bảo hành 12 tháng tại các trung tâm ủy quyền toàn quốc</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0">
              ⚡
            </div>
            <div>
              <h4 className="m-0 text-sm font-bold text-slate-900">Giao hàng hỏa tốc</h4>
              <p className="m-0 mt-0.5 text-xs text-slate-500 leading-relaxed">Nhận hàng trong 2 giờ nội thành, đóng gói chuẩn chống sốc</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0">
              🔄
            </div>
            <div>
              <h4 className="m-0 text-sm font-bold text-slate-900">Đổi trả 30 ngày</h4>
              <p className="m-0 mt-0.5 text-xs text-slate-500 leading-relaxed">Miễn phí 1 đổi 1 tận nơi nếu sản phẩm phát sinh lỗi kỹ thuật</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center text-lg shrink-0">
              🤖
            </div>
            <div>
              <h4 className="m-0 text-sm font-bold text-slate-900">Trợ lý AI 24/7</h4>
              <p className="m-0 mt-0.5 text-xs text-slate-500 leading-relaxed">Tư vấn chọn máy theo ngân sách và so sánh cấu hình chuẩn xác</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Links Area ── */}
      <div className="w-[min(1140px,92%)] mx-auto py-12 grid grid-cols-4 gap-8 max-[960px]:grid-cols-2 max-[540px]:grid-cols-1">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center font-black text-sm">
              T
            </span>
            <span className="text-base font-extrabold text-slate-900 tracking-tight">
              TechShop<span className="text-teal-600">.ai</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Hệ sinh thái bán lẻ thiết bị công nghệ chính hãng ứng dụng AI hỗ trợ tư vấn và so sánh sản phẩm theo thời gian thực.
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Hệ thống trực tuyến sẵn sàng phục vụ</span>
          </div>
        </div>

        <div>
          <h4 className="m-0 mb-3 text-xs font-bold text-slate-900 uppercase tracking-wider">Khám phá sản phẩm</h4>
          <ul className="list-none p-0 m-0 space-y-2 text-xs">
            <li><Link to="/products" className="text-slate-500 hover:text-teal-700 no-underline transition-colors">Điện thoại thông minh</Link></li>
            <li><Link to="/products" className="text-slate-500 hover:text-teal-700 no-underline transition-colors">Laptop & Máy tính xách tay</Link></li>
            <li><Link to="/products" className="text-slate-500 hover:text-teal-700 no-underline transition-colors">Máy tính bảng & Phụ kiện</Link></li>
            <li><Link to="/products" className="text-slate-500 hover:text-teal-700 no-underline transition-colors">Thiết bị âm thanh & Loa</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="m-0 mb-3 text-xs font-bold text-slate-900 uppercase tracking-wider">Hỗ trợ khách hàng</h4>
          <ul className="list-none p-0 m-0 space-y-2 text-xs">
            <li><Link to="/about" className="text-slate-500 hover:text-teal-700 no-underline transition-colors">Chính sách bảo hành & Đổi trả</Link></li>
            <li><Link to="/order-history" className="text-slate-500 hover:text-teal-700 no-underline transition-colors">Tra cứu đơn hàng</Link></li>
            <li><Link to="/cart" className="text-slate-500 hover:text-teal-700 no-underline transition-colors">Giỏ hàng & Thanh toán QR</Link></li>
            <li><span className="text-slate-500">Hotline: 1900 6868 (8:00 - 21:30)</span></li>
          </ul>
        </div>

        <div>
          <h4 className="m-0 mb-3 text-xs font-bold text-slate-900 uppercase tracking-wider">Trải nghiệm AI thông minh</h4>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            Bấm vào biểu tượng Chatbot ở góc phải để hỏi giá, so sánh cấu hình, hoặc tải ảnh lên để nhận diện sản phẩm tự động.
          </p>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600">
            💡 <strong className="text-slate-800">Mẹo:</strong> Thử hỏi <em>"Tư vấn laptop dưới 20 triệu cho sinh viên"</em>.
          </div>
        </div>
      </div>

      {/* ── Sub Footer (Bản quyền & Pháp lý) ── */}
      <div className="border-t border-slate-100 py-5 bg-white text-xs text-slate-400">
        <div className="w-[min(1140px,92%)] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <p className="m-0">© 2026 Tech Shop. Khóa luận tốt nghiệp Xây dựng website bán hàng ứng dụng AI.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-600 cursor-pointer">Bảo mật thông tin</span>
            <span>•</span>
            <span className="hover:text-slate-600 cursor-pointer">Điều khoản dịch vụ</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
