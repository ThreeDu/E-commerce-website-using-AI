import { Link } from "react-router-dom";
import { getProductImageSrc } from "../../../utils/productUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons";

function ProductTable({ getStockStatus, getStockStatusLabel, isAllOnPageSelected, paginatedProducts, selectedProductIds, setProductPendingDelete, toggleProductSelect, toggleSelectAllOnPage }) {
  return (
    <div className="border border-[#e2eaf4] rounded-2xl overflow-hidden bg-white w-full max-w-full">
      <div className="w-full max-w-full overflow-x-auto bg-white">
        <table className="w-full table-fixed min-w-0 text-[13px] border-collapse bg-white">
          <thead>
            <tr>
              <th className="w-[5%] text-center bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả sản phẩm trong trang"
                  checked={isAllOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                />
              </th>
              <th className="w-[10%] text-center bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Ảnh</th>
              <th className="w-[35%] text-left bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Sản phẩm</th>
              <th className="w-[20%] text-left bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Giá & giảm</th>
              <th className="w-[14%] text-left bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Tồn kho</th>
              <th className="w-[16%] text-left bg-[#f8fbff] text-[12px] uppercase tracking-wider text-[#6f7f94] font-semibold p-2 break-words whitespace-normal align-middle">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((product) => {
              const stockStatus = getStockStatus(product.stock);
              const stockClass = stockStatus === "in-stock"
                ? "text-[#166534] bg-[#e7f9ef]"
                : stockStatus === "low-stock"
                  ? "text-[#b45309] bg-[#fff3dd]"
                  : "text-[#b42318] bg-[#ffe8e8]";
              return (
                <tr key={product._id} className="transition-colors duration-180 hover:bg-[#f8fbff]">
                  <td className="text-center p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                    <input
                      type="checkbox"
                      aria-label={`Chọn sản phẩm ${product.name}`}
                      checked={selectedProductIds.includes(product._id)}
                      onChange={() => toggleProductSelect(product._id)}
                    />
                  </td>
                  <td className="text-center p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                    <Link to={`/products/${product._id}`} className="no-underline" title={`Xem chi tiết ${product.name}`}>
                      <img
                        src={getProductImageSrc(product)}
                        alt={product.name}
                        className="w-11 h-11 object-cover rounded-lg border border-[#d6dfeb]"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                    </Link>
                  </td>
                  <td className="text-left p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                    <Link
                      to={`/products/${product._id}`}
                      className="font-bold text-[#0f2233] block whitespace-normal overflow-visible break-words hover:text-blue-700 no-underline"
                      title={product.name}
                    >
                      {product.name}
                    </Link>
                    <div className="mt-1 text-[#62728a] text-[13px] block whitespace-normal overflow-visible break-words" title={product.category || "Chưa phân loại"}>
                      {product.category || "Chưa phân loại"}
                    </div>
                  </td>
                  <td className="text-left p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                    <div className="grid gap-1 min-w-0">
                      <span className="inline-flex items-center rounded-full p-[3px_6px] font-bold text-[11px] text-[#166534] bg-[#e7f9ef]">
                        {Number(product.finalPrice ?? product.price).toLocaleString("vi-VN")} đ
                      </span>
                      <span className="mt-1 text-[#62728a] text-[13px] block whitespace-normal overflow-visible break-words" title={`Giá gốc: ${Number(product.price).toLocaleString("vi-VN")} đ`}>
                        Giá gốc: {Number(product.price).toLocaleString("vi-VN")} đ
                      </span>
                      <span className="mt-1 text-[#62728a] text-[13px]">Giảm: {product.discountPercent ?? 0}%</span>
                    </div>
                  </td>
                  <td className="text-left p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                    <span className={`inline-flex items-center rounded-full p-[3px_6px] font-bold text-[11px] ${stockClass}`}>
                      {product.stock ?? 0} - {getStockStatusLabel(product.stock)}
                    </span>
                  </td>
                  <td className="text-left p-2 break-words whitespace-normal align-middle border-b border-[#edf2f8]">
                    <div className="flex gap-1 justify-start items-center flex-nowrap w-full">
                      <Link
                        to={`/admin/products/edit/${product._id}`}
                        className="p-[5px_8px] text-[11px] gap-0.75 whitespace-nowrap shrink-0 rounded-md inline-flex items-center border border-[#b5ccf0] bg-[#f6f9ff] text-[#0f3f84] font-semibold cursor-pointer"
                        title="Chỉnh sửa sản phẩm"
                      >
                        <FontAwesomeIcon icon={faPen} />
                        Sửa
                      </Link>
                      <button
                        type="button"
                        className="p-[5px_8px] text-[11px] gap-0.75 whitespace-nowrap shrink-0 rounded-md inline-flex items-center border border-[#df6b6b] bg-[#fff7f7] text-[#b42318] font-semibold cursor-pointer"
                        onClick={() => setProductPendingDelete(product)}
                        title="Xóa sản phẩm"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedProducts.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-[#657589] p-6">
                  Không tìm thấy sản phẩm phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProductTable;
