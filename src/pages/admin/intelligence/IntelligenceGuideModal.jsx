import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBrain, faTimes } from "@fortawesome/free-solid-svg-icons";

function IntelligenceGuideModal({ setShowGuideModal, showGuideModal }) {
  if (!showGuideModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,42,0.65)] backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowGuideModal(false)}>
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-[850px] max-h-[85vh] overflow-hidden border border-[#e2e8f0] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#f1f5f9] flex justify-between items-center bg-white shrink-0">
          <h2 className="m-0 text-lg md:text-xl font-bold text-[#0f172a] flex items-center gap-2">
            <FontAwesomeIcon icon={faBrain} className="text-admin-primary" />
            Giải thích chỉ số & Phân loại Phân khúc AI
          </h2>
          <button className="bg-none border-none text-admin-muted text-xl cursor-pointer p-1.5 rounded-lg flex items-center justify-center hover:bg-[#f1f5f9] hover:text-[#0f172a] transition-all" onClick={() => setShowGuideModal(false)}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto scrollbar-subtle flex-1">
          <div className="mb-6">
            <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b] border-l-4 border-[#6366f1] pl-2.5">1. Các chỉ số dự báo bằng Machine Learning</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4.5 flex flex-col gap-3">
                <div className="flex items-center">
                  <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800">Churn Risk (Tỷ lệ rời bỏ)</span>
                </div>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Định nghĩa:</strong> Xác suất khách hàng ngừng tương tác hoặc rời bỏ hệ thống trong tương lai gần.
                </p>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Cách tính:</strong> AI (Random Forest) phân tích chuỗi hoạt động thời gian thực (số lần tương tác chatbot, lượt xem sản phẩm, số ngày không mua hàng...) và so sánh với lịch sử rời bỏ của các khách hàng cũ để dự báo xác suất từ 0% đến 100%.
                </p>
                <div className="flex flex-col gap-1.5 mt-1 bg-white p-2.5 border border-[#f1f5f9] rounded-lg">
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-green-600">Thấp (≤ 30%):</strong> Gắn kết tốt, hoạt động đều.</div>
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-orange-500">Trung bình (31-70%):</strong> Cần chú ý, gửi nhắc nhở nhẹ.</div>
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-red-600">Cao (> 70%):</strong> Nguy cơ rời đi cực lớn, cần can thiệp khẩn cấp.</div>
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4.5 flex flex-col gap-3">
                <div className="flex items-center">
                  <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800">Potential (Điểm tiềm năng)</span>
                </div>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Định nghĩa:</strong> Triển vọng đóng góp giá trị dài hạn của khách hàng mới để trở thành khách hàng trung thành.
                </p>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Cách tính:</strong> Sử dụng mô hình <strong>Gradient Boosting Regressor</strong> để chấm điểm dựa trên hành vi ban đầu (tần suất thêm sản phẩm vào wishlist, xem chi tiết sản phẩm, tốc độ phản hồi chatbot và số lượng giao dịch ban đầu).
                </p>
                <div className="flex flex-col gap-1.5 mt-1 bg-white p-2.5 border border-[#f1f5f9] rounded-lg">
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-green-600">Cao (≥ 50):</strong> Có triển vọng lớn để phát triển thành khách hàng trung thành.</div>
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-slate-500">Thấp (&lt; 50):</strong> Khách hàng vãng lai hoặc ít tương tác.</div>
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4.5 flex flex-col gap-3 md:col-span-2">
                <div className="flex items-center">
                  <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">CLV Score (Dự đoán giá trị vòng đời)</span>
                </div>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Định nghĩa:</strong> Tổng giá trị kinh tế (số tiền chi tiêu) mà khách hàng dự kiến sẽ mang lại cho cửa hàng trong toàn bộ vòng đời mua sắm tương lai của họ.
                </p>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Cách tính:</strong> Sử dụng mô hình <strong>Gradient Boosting Regressor</strong> kết hợp với các chỉ số RFM thực tế để dự báo tổng chi tiêu dài hạn dựa trên: Monetary (tổng số tiền đã chi tiêu), Frequency (tần suất mua hàng), và Recency (mức độ gần đây của đơn hàng cuối).
                </p>
                <p className="m-0 text-[12.5px] text-[#475569] leading-relaxed bg-[#eff6ff] p-3 border-l-3 border-blue-500 rounded-lg">
                  💡 <strong>Ứng dụng:</strong> Giúp tối ưu hóa ngân sách tiếp thị. Chỉ tự động gửi Voucher giảm giá cao cho khách hàng có CLV lớn để giữ chân nguồn doanh thu cốt lõi, tránh lãng phí ngân sách đối với nhóm có CLV thấp.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b] border-l-4 border-[#6366f1] pl-2.5">2. Phân loại Phân khúc khách hàng (Segmentation)</h3>
            <p className="text-xs text-admin-muted mb-3.5">
              Hệ thống tự động phân loại khách hàng thành 6 nhóm RFM thông minh:
            </p>
            <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl bg-white">
              <table className="w-full border-collapse text-sm text-left">
                <thead>
                  <tr className="[&>th]:bg-[#f8fafc] [&>th]:p-3 [&>th]:font-bold [&>th]:color-[#475569] [&>th]:border-b-2 [&>th]:border-[#e2e8f0] [&>th]:text-xs [&>th]:uppercase [&>th]:tracking-wider">
                    <th>Phân khúc</th>
                    <th>Quy tắc phân loại (Hành vi & Điểm số AI)</th>
                    <th>Đặc điểm hành vi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-green-500 text-green-500 bg-green-50">🏆 Champion</span></td>
                    <td>Nghỉ mua ≤ 14 ngày, tần suất mua ≥ 5 lần và nằm trong nhóm 20% chi tiêu cao nhất.</td>
                    <td>Khách hàng giá trị nhất. Mua thường xuyên, chi tiêu cực nhiều và mới hoạt động gần đây.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-blue-500 text-blue-500 bg-blue-50">💎 Loyal</span></td>
                    <td>Nghỉ mua ≤ 30 ngày, tần suất mua ≥ 3 lần.</td>
                    <td>Mua sắm đều đặn, gắn bó lâu dài và phản hồi tốt với các chiến dịch.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-purple-500 text-purple-500 bg-purple-50">🌟 Potential Loyalist</span></td>
                    <td>Nghỉ mua ≤ 30 ngày, số đơn từ 1-2 lần, và có điểm tiềm năng AI (CLV) ≥ 50.</td>
                    <td>Khách hàng mới tiềm năng. Mua gần đây, số lượng ít nhưng có điểm tiềm năng cao.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-orange-500 text-orange-500 bg-orange-50">⚠️ At Risk</span></td>
                    <td>Điểm rời bỏ Churn Risk từ 31% đến 70%, đã mua ít nhất 2 đơn.</td>
                    <td>Khách hàng có nguy cơ. Từng mua nhiều nhưng đang giảm dần tần suất hoạt động.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-yellow-500 text-yellow-500 bg-yellow-50">😴 Hibernating</span></td>
                    <td>Điểm rời bỏ Churn Risk từ 71% đến 90% hoặc đã ngừng hoạt động trên 45 ngày.</td>
                    <td>Khách hàng ngủ đông. Đã lâu không mua sắm, ít tương tác, khả năng cao sẽ rời đi.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-red-500 text-red-500 bg-red-50">❌ Lost</span></td>
                    <td>Khách hàng không thuộc các nhóm trên (mặc định của hệ thống).</td>
                    <td>Mất liên lạc hoàn toàn hoặc khách hàng mới ít hoạt động, tiềm năng thấp.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntelligenceGuideModal;
