import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight, faAngleDoubleLeft, faAngleDoubleRight } from "@fortawesome/free-solid-svg-icons";

function CustomerTablePagination({ activePage, editingEllipsis, getPageNumbers, indexOfFirstItem, indexOfLastItem, inputPageValue, itemsPerPage, setCurrentPage, setEditingEllipsis, setInputPageValue, setItemsPerPage, totalItems, totalPages }) {
  if (!(totalPages > 0)) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 mt-4 border-t border-[#f1f5f9]">
      <div className="text-[13.5px] text-admin-muted font-medium">
        Hiển thị {totalItems === 0 ? 0 : indexOfFirstItem + 1} - {Math.min(indexOfLastItem, totalItems)} trong tổng số {totalItems} khách hàng
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
            className="p-1 border border-[#e2e8f0] rounded-lg bg-white focus:outline-none cursor-pointer"
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
            className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            onClick={() => setCurrentPage(1)}
            disabled={activePage === 1}
            title="Trang đầu"
          >
            <FontAwesomeIcon icon={faAngleDoubleLeft} />
          </button>

          {/* Previous Page */}
          <button
            className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={activePage === 1}
            title="Trang trước"
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>

          {/* Page Numbers */}
          {getPageNumbers().map((item, index) => {
            if (item.type === "ellipsis") {
              const isEditing = editingEllipsis === item.id;
              if (isEditing) {
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
                  key={`dots-${item.id}-${index}`}
                  type="button"
                  className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#94a3b8] text-[13px] font-bold cursor-pointer hover:bg-[#eef4fb]"
                  onClick={() => {
                    setEditingEllipsis(item.id);
                    setInputPageValue("");
                  }}
                  title="Nhấp để nhập trang trực tiếp"
                >
                  ...
                </button>
              );
            }
            return (
              <button
                key={`page-${item.value}`}
                className={`inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border text-[13px] font-bold cursor-pointer transition-all duration-150 hover:-translate-y-px ${
                  activePage === item.value
                    ? "bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] border-transparent text-white shadow-md hover:translate-y-0"
                    : "border-[#cbd5e8] bg-white text-[#5f6f85] hover:bg-[#eef4fb]"
                }`}
                onClick={() => setCurrentPage(item.value)}
              >
                {item.value}
              </button>
            );
          })}

          {/* Next Page */}
          <button
            className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={activePage === totalPages}
            title="Trang sau"
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>

          {/* Last Page */}
          <button
            className="inline-flex items-center justify-center min-w-[36px] h-9 px-2.5 rounded-xl border border-[#cbd5e8] bg-white text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            onClick={() => setCurrentPage(totalPages)}
            disabled={activePage === totalPages}
            title="Trang cuối"
          >
            <FontAwesomeIcon icon={faAngleDoubleRight} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerTablePagination;
