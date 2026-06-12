import { Link } from "react-router-dom";

function AboutPage() {
  return (
    <main className="w-[min(1100px,92%)] mx-auto flex-1 py-10">
      <section className="border border-text-primary rounded-2xl bg-[radial-gradient(circle_at_100%_-25%,rgba(15,118,110,0.14),transparent_42%),radial-gradient(circle_at_0%_100%,rgba(255,111,60,0.12),transparent_36%),#ffffff] p-6 max-[640px]:p-4 max-[640px]:rounded-[18px]">
        <header className="border border-[rgba(29,29,31,0.6)] rounded-[20px] bg-white/[0.86] p-6 max-[640px]:p-4">
          <p className="m-0 text-shop-primary text-xs font-extrabold tracking-[0.08em] uppercase">Về Tech Shop</p>
          <h1 className="mt-2.5 mb-0 text-[clamp(1.75rem,3.2vw,2.6rem)] leading-[1.08] tracking-[-0.02em] text-[#111827]">Nơi công nghệ và trải nghiệm mua sắm gặp nhau.</h1>
          <p className="mt-3.5 mb-0 max-w-[760px] text-[#334155] leading-[1.66]">
            Tech Shop xây dựng nền tảng thương mại điện tử tập trung vào tốc độ, giao diện rõ ràng và trải nghiệm đặt hàng liền mạch.
            Mỗi thành phần đều được thiết kế để giúp bạn tìm sản phẩm nhanh hơn, quyết định dễ hơn và thanh toán thuận tiện hơn.
          </p>
          <div className="mt-[18px] flex gap-2.5 flex-wrap">
            <Link to="/products" className="min-h-[44px] px-4 rounded-xl border border-text-primary inline-flex items-center justify-center no-underline text-sm font-bold transition-all duration-[180ms] bg-[#0f314f] text-white hover:-translate-y-px hover:brightness-[1.03]">Khám phá sản phẩm</Link>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-3 gap-3 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
          <article className="border border-text-primary rounded-[18px] bg-[#f9fbff] p-4">
            <h3 className="m-0 text-[1.08rem] text-[#0f172a]">Tầm nhìn</h3>
            <p className="mt-2.5 mb-0 text-[#334155] leading-relaxed">Tạo ra hành trình mua sắm thông minh, giảm thao tác dư thừa và tăng giá trị thực cho người dùng.</p>
          </article>
          <article className="border border-text-primary rounded-[18px] bg-[#f9fbff] p-4">
            <h3 className="m-0 text-[1.08rem] text-[#0f172a]">Nguyên tắc</h3>
            <p className="mt-2.5 mb-0 text-[#334155] leading-relaxed">Ưu tiên hiệu năng, minh bạch thông tin, bảo mật tài khoản và trải nghiệm nhất quán trên mọi thiết bị.</p>
          </article>
          <article className="border border-text-primary rounded-[18px] bg-[#f9fbff] p-4">
            <h3 className="m-0 text-[1.08rem] text-[#0f172a]">Cam kết</h3>
            <p className="mt-2.5 mb-0 text-[#334155] leading-relaxed">Liên tục tối ưu sản phẩm, lắng nghe phản hồi người dùng và duy trì chất lượng dịch vụ ổn định.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default AboutPage;
