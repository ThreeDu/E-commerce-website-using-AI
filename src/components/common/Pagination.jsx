import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

const PAGER_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-1.5 min-h-[34px] min-w-[92px] px-3.5 py-1.75 rounded-xl border border-[#cdd9e8] bg-[#f9fbfe] text-[#5f6f85] text-[13px] font-bold tracking-wide cursor-pointer transition-all duration-150 hover:-translate-y-px hover:bg-[#eef4fb] hover:text-[#3f4f67] hover:shadow-xs disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * "Trước | Trang x/y | Sau" pager used by the admin list pages.
 *
 * Props:
 * - currentPage  {number}
 * - totalPages   {number}
 * - onPageChange {function} Called with the new page number
 */
function Pagination({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={PAGER_BUTTON_CLASS}
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        <FontAwesomeIcon icon={faChevronLeft} />
        Trước
      </button>
      <span className="min-w-[100px] text-center text-[#4b5b73] font-semibold text-sm">
        Trang {currentPage}/{totalPages}
      </span>
      <button
        type="button"
        className={PAGER_BUTTON_CLASS}
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        Sau
        <FontAwesomeIcon icon={faChevronRight} />
      </button>
    </div>
  );
}

export default Pagination;
