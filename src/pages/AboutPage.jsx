import { Link } from "react-router-dom";
import "../css/static-pages.css";

function AboutPage() {
  return (
    <main className="container page-content">
      <section className="static-page-wrap">
        <header className="static-page-hero">
          <p className="static-kicker">Về Tech Shop</p>
          <h1>Nơi công nghệ và trải nghiệm mua sắm gặp nhau.</h1>
          <p>
            Tech Shop xây dựng nền tảng thương mại điện tử tập trung vào tốc độ, giao diện rõ ràng và trải nghiệm đặt hàng liền mạch.
            Mỗi thành phần đều được thiết kế để giúp bạn tìm sản phẩm nhanh hơn, quyết định dễ hơn và thanh toán thuận tiện hơn.
          </p>
          <div className="static-actions">
            <Link to="/products" className="static-btn static-btn--primary">Khám phá sản phẩm</Link>
          </div>
        </header>

        <div className="static-grid">
          <article className="static-card">
            <h3>Tầm nhìn</h3>
            <p>Tạo ra hành trình mua sắm thông minh, giảm thao tác dư thừa và tăng giá trị thực cho người dùng.</p>
          </article>
          <article className="static-card">
            <h3>Nguyên tắc</h3>
            <p>Ưu tiên hiệu năng, minh bạch thông tin, bảo mật tài khoản và trải nghiệm nhất quán trên mọi thiết bị.</p>
          </article>
          <article className="static-card">
            <h3>Cam kết</h3>
            <p>Liên tục tối ưu sản phẩm, lắng nghe phản hồi người dùng và duy trì chất lượng dịch vụ ổn định.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default AboutPage;
