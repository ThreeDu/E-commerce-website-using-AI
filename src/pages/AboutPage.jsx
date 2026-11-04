import { useEffect } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGraduationCap,
  faLaptopCode,
  faBrain,
  faRobot,
  faCircleCheck,
  faArrowRight,
  faLayerGroup,
  faWandMagicSparkles,
  faIdCard,
  faChartLine,
  faLightbulb,
  faCompass,
  faCode,
} from "@fortawesome/free-solid-svg-icons";

function AboutPage() {
  useEffect(() => {
    document.title = "Giới thiệu Đồ án Tốt nghiệp | TechShop.ai";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <main className="w-[min(1140px,92%)] mx-auto flex-1 py-8 sm:py-12 flex flex-col gap-10">
      {/* ── 1. Hero & Project Overview ── */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-teal-50/40 p-6 sm:p-10 shadow-sm">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-teal-100/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded-full bg-blue-100/30 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-bold tracking-wide uppercase shadow-2xs">
            <FontAwesomeIcon icon={faGraduationCap} className="text-teal-600 text-sm" />
            <span>Đồ án Tốt nghiệp • Khóa luận 2026</span>
          </div>

          <h1 className="mt-4 mb-3 text-2xl sm:text-4xl lg:text-[2.6rem] font-black text-slate-900 tracking-tight leading-[1.15]">
            Hệ Thống Thương Mại Điện Tử Thông Minh{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-sky-600">
              Ứng Dụng AI
            </span>
          </h1>

          <p className="m-0 text-slate-600 text-sm sm:text-base leading-relaxed">
            Dự án khóa luận tốt nghiệp nghiên cứu và phát triển nền tảng mua sắm trực tuyến toàn diện (Fullstack), kết hợp
            các tính năng thương mại điện tử cốt lõi với AI và Machine Learning nhằm cá nhân hóa trải nghiệm khách hàng
            và tối ưu hóa quản trị vận hành theo thời gian thực.
          </p>

          {/* Quick Stats / Tech Tags */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {[
              "React 19",
              "Node.js / Express",
              "Python ML Service",
              "MongoDB",
              "Google Gemini & Local LLM",
              "Scikit-learn",
              "Tailwind CSS",
            ].map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/90 border border-slate-200/90 text-slate-700 text-xs font-semibold shadow-2xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                {tech}
              </span>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold no-underline transition-all shadow-xs hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Khám phá sản phẩm</span>
              <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-semibold no-underline transition-all shadow-2xs hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Về trang chủ</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. Team Members Section ── */}
      <section className="flex flex-col gap-5">
        <div>
          <div className="inline-flex items-center gap-2 text-teal-700 text-xs font-extrabold uppercase tracking-widest">
            <FontAwesomeIcon icon={faLaptopCode} />
            <span>Đội Ngũ Thực Hiện</span>
          </div>
          <h2 className="mt-1 mb-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Phân Công Công Việc Thành Viên
          </h2>
          <p className="m-0 text-slate-500 text-xs sm:text-sm">
            Trách nhiệm và nhóm chức năng cụ thể được phân chia trong đồ án tốt nghiệp.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Member 1: Trương Hoài Khang */}
          <div className="group rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-teal-300 transition-all duration-200 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 to-sky-700 text-white flex items-center justify-center font-black text-lg shadow-sm">
                    TK
                  </div>
                  <div>
                    <h3 className="m-0 text-base sm:text-lg font-bold text-slate-900">
                      Trương Hoài Khang
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                        <FontAwesomeIcon icon={faIdCard} className="text-[10px]" />
                        2274802010389
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60 shrink-0">
                  Admin & AI Analytics
                </span>
              </div>

              {/* Role summary */}
              <p className="mt-3.5 mb-0 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                Phụ trách phát triển toàn bộ hệ thống quản trị (Admin Portal) và các chức năng AI phân tích dữ liệu, dự đoán hành vi khách hàng.
              </p>

              {/* Main tasks list */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Chức năng chính thực hiện:
                </p>
                <ul className="m-0 p-0 list-none space-y-2.5 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-teal-600 text-xs mt-1 shrink-0" />
                    <span>
                      <strong>Hệ thống Quản trị (Admin):</strong> Dashboard tổng quan, quản lý sản phẩm, danh mục, đơn hàng, mã giảm giá, người dùng, thông báo và System Logs.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-teal-600 text-xs mt-1 shrink-0" />
                    <span>
                      <strong>AI Customer Intelligence:</strong> Xây dựng mô hình học máy (Random Forest, Gradient Boosting) dự đoán nguy cơ khách hàng rời bỏ (Churn) và đánh giá khách hàng tiềm năng.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-teal-600 text-xs mt-1 shrink-0" />
                    <span>
                      <strong>Gợi ý & Mô hình Dữ liệu:</strong> Phát triển Recommendation System, API phân tích và thiết kế data models (AnalyticsEvents, AuditLogs, Discounts).
                    </span>
                  </li>
                </ul>
              </div>

              {/* Tech Stack Pills */}
              <div className="mt-4 pt-3.5 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faCode} className="text-[10px]" />
                  <span>Công nghệ sử dụng:</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["React", "Node.js", "Express.js", "MongoDB", "Machine Learning", "Random Forest", "Gradient Boosting"].map((tech) => (
                    <span key={tech} className="px-2 py-0.5 rounded-md bg-teal-50/70 border border-teal-200/50 text-teal-800 text-[11px] font-semibold">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Member 2: Trần Anh Khoa */}
          <div className="group rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs hover:shadow-md hover:border-sky-300 transition-all duration-200 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-sm">
                    AK
                  </div>
                  <div>
                    <h3 className="m-0 text-base sm:text-lg font-bold text-slate-900">
                      Trần Anh Khoa
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/60">
                        <FontAwesomeIcon icon={faIdCard} className="text-[10px]" />
                        2274802010424
                      </span>
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/60 shrink-0">
                  UI & AI Chatbot Lead
                </span>
              </div>

              {/* Role summary */}
              <p className="mt-3.5 mb-0 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                Phụ trách phát triển toàn bộ giao diện người dùng (User Interface) và hệ thống Chatbot AI hỗ trợ tư vấn mua sắm thông minh.
              </p>

              {/* Main tasks list */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Chức năng chính thực hiện:
                </p>
                <ul className="m-0 p-0 list-none space-y-2.5 text-xs sm:text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-sky-600 text-xs mt-1 shrink-0" />
                    <span>
                      <strong>Giao diện Storefront & Mua sắm:</strong> Trang chủ, danh mục sản phẩm, chi tiết sản phẩm, bộ lọc tìm kiếm, giỏ hàng, thanh toán và quản lý đơn hàng.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-sky-600 text-xs mt-1 shrink-0" />
                    <span>
                      <strong>Tương tác Khách hàng:</strong> Quản lý tài khoản cá nhân, xác thực đăng nhập/đăng ký, danh sách yêu thích (Wishlist) và layout/components dùng chung.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <FontAwesomeIcon icon={faCircleCheck} className="text-sky-600 text-xs mt-1 shrink-0" />
                    <span>
                      <strong>Trợ lý Chatbot AI:</strong> Giao diện & API chatbot, tích hợp NLP/LLM tư vấn mua sắm, đề xuất dựa trên tương tác (KNN Collaborative Filtering) và model ChatbotEvents.
                    </span>
                  </li>
                </ul>
              </div>

              {/* Tech Stack Pills */}
              <div className="mt-4 pt-3.5 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faCode} className="text-[10px]" />
                  <span>Công nghệ sử dụng:</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["React", "Node.js", "Express.js", "MongoDB", "NLP", "LLM Integration", "KNN Collaborative Filtering"].map((tech) => (
                    <span key={tech} className="px-2 py-0.5 rounded-md bg-sky-50/70 border border-sky-200/50 text-sky-800 text-[11px] font-semibold">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Core Highlights / Solutions ── */}
      <section className="flex flex-col gap-5">
        <div>
          <div className="inline-flex items-center gap-2 text-teal-700 text-xs font-extrabold uppercase tracking-widest">
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            <span>Trọng Tâm Nghiên Cứu</span>
          </div>
          <h2 className="mt-1 mb-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Điểm Sáng Công Nghệ Của Đồ Án
          </h2>
          <p className="m-0 text-slate-500 text-xs sm:text-sm">
            Ba trụ cột giải pháp nổi bật được tích hợp xuyên suốt trong hệ thống.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: E-commerce */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center text-lg mb-4">
              <FontAwesomeIcon icon={faLayerGroup} />
            </div>
            <h3 className="m-0 text-base font-bold text-slate-900 mb-2">
              Sàn E-Commerce Hiện Đại
            </h3>
            <p className="m-0 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Trải nghiệm mua sắm mượt mà với bộ lọc đa chiều, tìm kiếm theo danh mục phân cấp, giỏ hàng tức thì, áp dụng voucher tự động tính toán điều kiện, thanh toán trực tuyến qua mã QR và hệ thống điểm thưởng thành viên.
            </p>
          </div>

          {/* Card 2: AI & LLM */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center text-lg mb-4">
              <FontAwesomeIcon icon={faRobot} />
            </div>
            <h3 className="m-0 text-base font-bold text-slate-900 mb-2">
              Trợ Lý AI & RAG Song Hành
            </h3>
            <p className="m-0 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Tích hợp cơ chế RAG Vector Search tìm kiếm sản phẩm theo ngữ nghĩa, so sánh cấu hình chuẩn xác. Hỗ trợ trợ lý quản trị xử lý số liệu doanh thu bằng văn bản tự nhiên cùng cơ chế Fallback linh hoạt giữa Local LLM và Cloud AI.
            </p>
          </div>

          {/* Card 3: Machine Learning */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center text-lg mb-4">
              <FontAwesomeIcon icon={faBrain} />
            </div>
            <h3 className="m-0 text-base font-bold text-slate-900 mb-2">
              Học Máy Dự Đoán Hành Vi
            </h3>
            <p className="m-0 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Microservice phân tích độc lập huấn luyện mô hình dự đoán khả năng khách hàng rời bỏ (Churn Rate) và phân nhóm tiềm năng, giúp nhà bán hàng tự động phát hiện nguy cơ và tung chiến dịch giữ chân khách hàng hiệu quả.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. Project Objectives & Impact ── */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-teal-700 text-xs font-extrabold uppercase tracking-widest mb-1">
            <FontAwesomeIcon icon={faCompass} />
            <span>Ý Nghĩa & Mục Tiêu</span>
          </div>
          <h2 className="m-0 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Mục Tiêu Đề Tài Hướng Đến
          </h2>
          <p className="mt-2.5 mb-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
            Đồ án được thực hiện nhằm minh chứng cho việc đưa các công nghệ AI và Machine Learning mới nhất vào giải quyết các bài toán thực tiễn của một nền tảng bán lẻ điện tử, giải phóng sức lao động thủ công và tạo ra giá trị thiết thực cho cả người mua lẫn người quản trị.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-200/80">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 text-sm">
                <FontAwesomeIcon icon={faLightbulb} />
              </div>
              <div>
                <h4 className="m-0 text-xs sm:text-sm font-bold text-slate-900">
                  Trải nghiệm người dùng thông minh
                </h4>
                <p className="mt-1 mb-0 text-xs text-slate-500 leading-relaxed">
                  Rút ngắn thời gian tìm kiếm, tư vấn chính xác và tương tác tự nhiên như có chuyên viên bán hàng riêng.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-200/80">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 text-sm">
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <div>
                <h4 className="m-0 text-xs sm:text-sm font-bold text-slate-900">
                  Tối ưu quyết định kinh doanh
                </h4>
                <p className="mt-1 mb-0 text-xs text-slate-500 leading-relaxed">
                  Cung cấp góc nhìn dữ liệu tức thì, dự báo biến động khách hàng và tự động hóa các tác vụ quản trị lặp lại.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AboutPage;
