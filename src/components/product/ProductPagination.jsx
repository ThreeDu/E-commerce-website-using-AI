import { getPageNumbers } from "../../utils/pagination";

function ProductPagination({ editingEllipsis, inputPageValue, setCurrentPage, setEditingEllipsis, setInputPageValue, totalPages, validCurrentPage }) {
  if (!(totalPages > 1)) {
    return null;
  }

  return (
    <div className="flex justify-center items-center gap-2 mt-8 py-2.5">
      <button
        type="button"
        className="inline-flex items-center justify-center min-w-[40px] h-10 px-3.5 rounded-shop-md border border-shop-line bg-white text-shop-ink font-semibold cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:bg-shop-bg hover:border-shop-muted hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-shop-bg"
        disabled={validCurrentPage === 1}
        onClick={() => {
          setCurrentPage((prev) => Math.max(1, prev - 1));
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        Trước
      </button>
      {getPageNumbers(validCurrentPage, totalPages).map((item, index) => {
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
                      window.scrollTo({ top: 0, behavior: "smooth" });
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
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                  setEditingEllipsis(null);
                }}
                autoFocus
                className="inline-flex items-center justify-center w-[60px] h-10 p-0 text-center border border-shop-primary bg-white text-shop-ink outline-none rounded-shop-md"
              />
            );
          }

          return (
            <button
              key={`dots-${item.id}-${index}`}
              type="button"
              className="inline-flex items-center justify-center min-w-[40px] h-10 text-shop-muted font-bold text-[15px] cursor-pointer hover:text-shop-primary"
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
            type="button"
            className={`inline-flex items-center justify-center min-w-[40px] h-10 px-3.5 rounded-shop-md border border-shop-line bg-white text-shop-ink font-semibold cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:bg-shop-bg hover:border-shop-muted hover:-translate-y-px ${validCurrentPage === item.value ? "bg-shop-primary text-white border-shop-primary hover:bg-shop-primary hover:text-white hover:border-shop-primary" : ""}`}
            onClick={() => {
              setCurrentPage(item.value);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {item.value}
          </button>
        );
      })}
      <button
        type="button"
        className="inline-flex items-center justify-center min-w-[40px] h-10 px-3.5 rounded-shop-md border border-shop-line bg-white text-shop-ink font-semibold cursor-pointer transition-all duration-200 shadow-[0_4px_10px_rgba(0,0,0,0.02)] hover:bg-shop-bg hover:border-shop-muted hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-shop-bg"
        disabled={validCurrentPage === totalPages}
        onClick={() => {
          setCurrentPage((prev) => Math.min(totalPages, prev + 1));
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        Sau
      </button>
    </div>
  );
}

export default ProductPagination;
