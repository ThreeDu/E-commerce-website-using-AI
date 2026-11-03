import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHistory, faExclamationTriangle, faClock, faChevronLeft, faChevronRight, faAngleDoubleLeft, faAngleDoubleRight } from "@fortawesome/free-solid-svg-icons";
import { getPageNumbers } from "../../../utils/pagination";

function CampaignHistory({ activePage, currentHistory, editingEllipsis, history, indexOfFirstItem, indexOfLastItem, inputPageValue, itemsPerPage, loadingHistory, setCurrentPage, setEditingEllipsis, setInputPageValue, setItemsPerPage, totalPages }) {
  return (
    <div className="bg-white rounded-2xl border border-admin-line shadow-xs p-6">
      <h2 className="text-lg md:text-xl font-bold text-admin-ink mb-5 flex items-center gap-2">
        <FontAwesomeIcon icon={faHistory} className="text-[#4f46e5]" />
        Lịch sử chiến dịch giữ chân khách hàng (Campaign Logs)
      </h2>

      {loadingHistory ? (
        <p className="text-center py-6 text-admin-muted font-medium">
          Đang tải lịch sử...
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="[&>th]:p-3 [&>th]:bg-[#f1f5f9] [&>th]:font-semibold [&>th]:text-xs [&>th]:text-admin-muted [&>th]:uppercase [&>th]:border-b-2 [&>th]:border-admin-line">
                <th>Thời gian</th>
                <th>Chiến dịch</th>
                <th>Khách hàng nhận</th>
                <th>Nội dung thông báo gửi đi</th>
                <th>Mã Voucher tặng kèm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {currentHistory.map((item) => (
                <tr key={item._id} className="hover:bg-[#f8fafc] [&>td]:p-3 [&>td]:text-admin-ink">
                  <td className="whitespace-nowrap">
                    <FontAwesomeIcon icon={faClock} className="mr-1.5 text-[#94a3b8]" />
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${item.type === "churn_intervention" ? "bg-red-100 text-red-600" : "bg-sky-100 text-sky-700"}`}>
                      {item.type === "churn_intervention" ? "Can thiệp Churn" : "Nhắc nhở giỏ hàng"}
                    </span>
                  </td>
                  <td>
                    {item.user ? (
                      <div>
                        <strong>{item.user.name}</strong>
                        <br />
                        <span className="text-xs text-admin-muted">{item.user.email}</span>
                      </div>
                    ) : (
                      <span className="text-red-600 text-xs font-bold">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" /> Khách đã xóa
                      </span>
                    )}
                  </td>
                  <td className="max-w-[350px] text-xs text-[#475569] leading-relaxed">{item.message}</td>
                  <td>
                    {item.data?.voucherCode ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700 border border-dashed border-amber-400">{item.data.voucherCode}</span>
                    ) : (
                      <span className="text-admin-muted text-xs">— (Không tặng mã)</span>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-admin-muted">
                    Chưa có chiến dịch giữ chân nào được thực hiện.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 0 && history.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 mt-4 border-t border-admin-line">
              <div className="text-[13.5px] text-admin-muted font-medium">
                Hiển thị {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, history.length)} trong tổng số {history.length} bản ghi
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {/* Page Size Selector */}
                <div className="flex items-center gap-2 text-[13.5px] text-admin-muted font-medium">
                  <span>Số hàng:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="p-1 border border-admin-line rounded-lg bg-white focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* Page Navigation Buttons */}
                <div className="flex items-center gap-1.5">
                  {/* First Page */}
                  <button
                    className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={() => setCurrentPage(1)}
                    disabled={activePage === 1}
                    title="Trang đầu"
                  >
                    <FontAwesomeIcon icon={faAngleDoubleLeft} />
                  </button>

                  {/* Previous Page */}
                  <button
                    className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={activePage === 1}
                    title="Trang trước"
                  >
                    <FontAwesomeIcon icon={faChevronLeft} />
                  </button>

                  {/* Page Numbers */}
                  {getPageNumbers(activePage, totalPages).map((item, index) => {
                    if (item.type === "ellipsis") {
                      if (editingEllipsis === item.id) {
                        return (
                          <input
                            key={`ellipsis-input-${item.id}-${index}`}
                            type="number"
                            min="1"
                            max={totalPages}
                            value={inputPageValue}
                            onChange={(e) => setInputPageValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const pageNum = parseInt(inputPageValue, 10);
                                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                  setCurrentPage(pageNum);
                                }
                                setEditingEllipsis(null);
                              } else if (e.key === "Escape") {
                                setEditingEllipsis(null);
                              }
                            }}
                            onBlur={() => {
                              const pageNum = parseInt(inputPageValue, 10);
                              if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                                setCurrentPage(pageNum);
                              }
                              setEditingEllipsis(null);
                            }}
                            autoFocus
                            className="inline-flex items-center justify-center w-[50px] h-9 px-1 rounded-xl border border-admin-primary bg-white text-admin-ink text-center text-[13px] font-bold outline-none"
                          />
                        );
                      }
                      return (
                        <button
                          key={`dots-${index}`}
                          type="button"
                          className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#94a3b8] text-[13px] font-bold cursor-pointer hover:bg-[#eef4fb]"
                          onClick={() => {
                            setEditingEllipsis(item.id);
                            setInputPageValue("");
                          }}
                          title="Nhấp để nhập số trang mong muốn"
                        >
                          ...
                        </button>
                      );
                    }
                    return (
                      <button
                        key={item.value}
                        className={`inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border text-[13px] font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px ${
                          activePage === item.value
                            ? "bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] border-transparent text-white shadow-md hover:translate-y-0"
                            : "border-admin-line bg-white text-[#5f6f85] hover:bg-[#eef4fb]"
                        }`}
                        onClick={() => setCurrentPage(item.value)}
                      >
                        {item.value}
                      </button>
                    );
                  })}

                  {/* Next Page */}
                  <button
                    className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={activePage === totalPages}
                    title="Trang sau"
                  >
                    <FontAwesomeIcon icon={faChevronRight} />
                  </button>

                  {/* Last Page */}
                  <button
                    className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-admin-line bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={activePage === totalPages}
                    title="Trang cuối"
                  >
                    <FontAwesomeIcon icon={faAngleDoubleRight} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CampaignHistory;
