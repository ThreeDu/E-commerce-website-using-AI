import { Link } from "react-router-dom";

function ContractPage() {
  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="border border-text-primary rounded-2xl bg-[radial-gradient(circle_at_100%_-25%,rgba(15,118,110,0.14),transparent_42%),radial-gradient(circle_at_0%_100%,rgba(255,111,60,0.12),transparent_36%),#ffffff] p-6 max-[640px]:p-4 max-[640px]:rounded-[18px]">
        <header className="border border-[rgba(29,29,31,0.6)] rounded-[20px] bg-gradient-to-br from-white to-[#f0f9ff] p-6 max-[640px]:p-4">
          <p className="m-0 text-shop-primary text-xs font-extrabold tracking-[0.08em] uppercase">Liên hệ</p>
          <h1 className="mt-2.5 mb-0 text-[clamp(1.75rem,3.2vw,2.6rem)] leading-[1.08] tracking-[-0.02em] text-[#111827]">Thông tin hợp tác và liên hệ làm việc</h1>
          <p className="mt-3.5 mb-0 max-w-[760px] text-[#334155] leading-[1.66]">
            Nếu bạn cần hợp tác kinh doanh, tích hợp hệ thống hoặc làm việc theo dự án,
            Tech Shop luôn sẵn sàng trao đổi để tạo ra giải pháp phù hợp với mục tiêu của bạn.
          </p>
        </header>

        <div className="mt-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
          <article className="border border-text-primary rounded-[18px] bg-[#f9fbff] p-4">
            <h3 className="m-0 text-[1.08rem] text-[#0f172a]">Hợp tác thương mại</h3>
            <p className="mt-2.5 mb-0 text-[#334155] leading-relaxed">Gửi đề xuất qua email: business@techshop.local</p>
          </article>
          <article className="border border-text-primary rounded-[18px] bg-[#f9fbff] p-4">
            <h3 className="m-0 text-[1.08rem] text-[#0f172a]">Hỗ trợ kỹ thuật</h3>
            <p className="mt-2.5 mb-0 text-[#334155] leading-relaxed">Hotline: 1900 1234 (08:00 - 21:00 mỗi ngày)</p>
          </article>
          <article className="border border-text-primary rounded-[18px] bg-[#f9fbff] p-4">
            <h3 className="m-0 text-[1.08rem] text-[#0f172a]">Địa chỉ làm việc</h3>
            <p className="mt-2.5 mb-0 text-[#334155] leading-relaxed">Tầng 8, AI Hub Tower, Quận 1, TP. Hồ Chí Minh</p>
          </article>
        </div>

        <div className="mt-4 border border-dashed border-[rgba(29,29,31,0.45)] rounded-2xl p-3.5 flex items-center justify-between gap-3 flex-wrap">
          <p className="m-0 font-semibold text-text-primary">Cần hỗ trợ mua hàng nhanh?</p>
          <Link to="/products" className="min-h-[44px] px-4 rounded-xl border border-text-primary inline-flex items-center justify-center no-underline text-sm font-bold transition-all duration-[180ms] bg-[#0f314f] text-white hover:-translate-y-px hover:brightness-[1.03]">Đến trang sản phẩm</Link>
        </div>
      </section>
    </main>
  );
}

export default ContractPage;
