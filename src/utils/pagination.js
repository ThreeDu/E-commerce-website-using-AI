/**
 * Page buttons for a pager showing at most 7 items:
 * [{ type: "page", value }, { type: "ellipsis", id: "left" | "right" }, ...]
 */
export function getPageNumbers(activePage, totalPages) {
  const pages = [];
  const maxVisible = 7;

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push({ type: "page", value: i });
    }
  } else {
    if (activePage <= 4) {
      for (let i = 1; i <= 5; i++) {
        pages.push({ type: "page", value: i });
      }
      pages.push({ type: "ellipsis", id: "right" });
      pages.push({ type: "page", value: totalPages });
    } else if (activePage >= totalPages - 3) {
      pages.push({ type: "page", value: 1 });
      pages.push({ type: "ellipsis", id: "left" });
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push({ type: "page", value: i });
      }
    } else {
      pages.push({ type: "page", value: 1 });
      pages.push({ type: "ellipsis", id: "left" });
      pages.push({ type: "page", value: activePage - 1 });
      pages.push({ type: "page", value: activePage });
      pages.push({ type: "page", value: activePage + 1 });
      pages.push({ type: "ellipsis", id: "right" });
      pages.push({ type: "page", value: totalPages });
    }
  }
  return pages;
}
