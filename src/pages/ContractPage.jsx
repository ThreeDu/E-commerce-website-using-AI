import { Link } from "react-router-dom";
import "../css/static-pages.css";

function ContractPage() {
  return (
    <main className="container page-content">
      <section className="static-page-wrap">
        <header className="static-page-hero static-page-hero--contract">
          <p className="static-kicker">Liên hệ</p>
          <h1>Thông tin hợp tác và liên hệ làm việc</h1>
          <p>
            Nếu bạn cần hợp tác kinh doanh, tích hợp hệ thống hoặc làm việc theo dự án,
            Tech Shop luôn sẵn sàng trao đổi để tạo ra giải pháp phù hợp với mục tiêu của bạn.
          </p>
        </header>

        <div className="static-grid static-grid--contract">
          <article className="static-card">
            <h3>Hợp tác thương mại</h3>
            <p>Gửi đề xuất qua email: business@techshop.local</p>
          </article>
          <article className="static-card">
            <h3>Hỗ trợ kỹ thuật</h3>
            <p>Hotline: 1900 1234 (08:00 - 21:00 mỗi ngày)</p>
          </article>
          <article className="static-card">
            <h3>Địa chỉ làm việc</h3>
            <p>Tầng 8, AI Hub Tower, Quận 1, TP. Hồ Chí Minh</p>
          </article>
        </div>

        <div className="static-footnote">
          <p>Cần hỗ trợ mua hàng nhanh?</p>
          <Link to="/products" className="static-btn static-btn--primary">Đến trang sản phẩm</Link>
        </div>
      </section>
    </main>
  );
}

export default ContractPage;
