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
                  <strong>Định nghĩa:</strong> Xác suất một khách đã từng mua sẽ <strong>không có đơn hoàn tất nào trong 45 ngày tới</strong>.
                </p>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Cách tính:</strong> Mô hình <strong>Gradient Boosting</strong> học từ lịch sử thật: tại nhiều mốc thời gian trong quá khứ, hệ thống lấy hành vi của khách trước mốc (số ngày từ lần mua cuối, tần suất, lượt xem, thêm giỏ, chatbot...) và đối chiếu khách đó có quay lại mua trong 45 ngày sau mốc hay không.
                </p>
                <div className="flex flex-col gap-1.5 mt-1 bg-white p-2.5 border border-[#f1f5f9] rounded-lg">
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-green-600">Thấp (≤ 30%):</strong> Gắn kết tốt, hoạt động đều.</div>
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-orange-500">Trung bình (30–60%):</strong> Cần chú ý, gửi nhắc nhở nhẹ.</div>
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-red-600">Cao (&gt; 60%):</strong> Nguy cơ rời đi lớn, cần can thiệp giữ chân.</div>
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4.5 flex flex-col gap-3">
                <div className="flex items-center">
                  <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800">Potential (Điểm tiềm năng)</span>
                </div>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Định nghĩa:</strong> Xác suất khách <strong>phát sinh ít nhất một đơn hoàn tất trong 30 ngày tới</strong> (áp dụng cả cho khách mới chưa từng mua).
                </p>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Cách tính:</strong> Mô hình <strong>Gradient Boosting</strong> phân loại, học theo cùng cách với Churn: hành vi trước mốc thời gian và việc khách có mua trong 30 ngày sau mốc hay không.
                </p>
                <div className="flex flex-col gap-1.5 mt-1 bg-white p-2.5 border border-[#f1f5f9] rounded-lg">
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-green-600">Cao (&gt; 60):</strong> Nhiều khả năng sắp mua, nên ưu tiên gợi ý sản phẩm / ưu đãi.</div>
                  <div className="text-[12.5px] text-[#475569]"><strong className="text-slate-500">Thấp (≤ 30):</strong> Khách vãng lai hoặc ít tương tác gần đây.</div>
                </div>
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-4.5 flex flex-col gap-3 md:col-span-2">
                <div className="flex items-center">
                  <span className="inline-block px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">CLV (Chi tiêu dự đoán)</span>
                </div>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Định nghĩa:</strong> Tổng giá trị đơn hoàn tất khách dự kiến mang lại trong <strong>60 ngày tới</strong> (cột "Chi tiêu dự đoán"). <strong>CLV Score</strong> là thứ hạng phần trăm của con số này so với các khách khác (100 = chi tiêu dự đoán cao nhất).
                </p>
                <p className="m-0 text-[13px] text-[#334155] leading-relaxed">
                  <strong>Cách tính:</strong> Mô hình <strong>Gradient Boosting Regressor</strong> (hàm mất mát Poisson, phù hợp số tiền không âm) học từ chi tiêu thật của khách trong 60 ngày sau mỗi mốc thời gian quá khứ.
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
                    <td>Nghỉ mua ≤ 14 ngày, tần suất mua ≥ 5 lần, thuộc nhóm 20% chi tiêu cao nhất và Churn Risk ≤ 50%.</td>
                    <td>Khách hàng giá trị nhất. Mua thường xuyên, chi tiêu cực nhiều và mới hoạt động gần đây.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-blue-500 text-blue-500 bg-blue-50">💎 Loyal</span></td>
                    <td>Nghỉ mua ≤ 30 ngày, tần suất mua ≥ 3 lần và Churn Risk ≤ 50% (hoặc mua đều ≥ 3 lần, chưa quá 45 ngày, vẫn dự đoán ở lại).</td>
                    <td>Mua sắm đều đặn, gắn bó lâu dài và phản hồi tốt với các chiến dịch.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-purple-500 text-purple-500 bg-purple-50">🌟 Potential Loyalist</span></td>
                    <td>Nghỉ mua ≤ 30 ngày, 1–2 đơn, Potential ≥ 50 và Churn Risk ≤ 50%; gồm cả khách mới chưa mua nhưng Potential ≥ 50.</td>
                    <td>Khách hàng mới tiềm năng. Mua gần đây, số lượng ít nhưng có điểm tiềm năng cao.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-orange-500 text-orange-500 bg-orange-50">⚠️ At Risk</span></td>
                    <td>Đã mua trong 45 ngày gần đây nhưng Churn Risk &gt; 50%, hoặc Churn Risk 30–70% và đã mua ít nhất 2 đơn.</td>
                    <td>Khách hàng có nguy cơ. Từng mua nhiều nhưng đang giảm dần tần suất hoạt động.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-yellow-500 text-yellow-500 bg-yellow-50">😴 Hibernating</span></td>
                    <td>Churn Risk 70–90% hoặc đã mua nhưng ngừng mua trên 45 ngày.</td>
                    <td>Khách hàng ngủ đông. Đã lâu không mua sắm, ít tương tác, khả năng cao sẽ rời đi.</td>
                  </tr>
                  <tr className="[&>td]:p-3.5 [&>td]:text-[#334155] [&>td]:leading-relaxed [&>td]:align-middle">
                    <td className="whitespace-nowrap"><span className="inline-block px-2.5 py-1 text-xs font-bold rounded-full border border-red-500 text-red-500 bg-red-50">❌ Lost</span></td>
                    <td>Còn lại: chưa từng mua và tiềm năng thấp, hoặc gần như chắc chắn đã rời bỏ.</td>
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
