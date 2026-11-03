import { formatDateTime } from "../../../utils/formatUtils";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons";

function DiscountTable({ getDiscountStatus, getRemainingQuantity, isAllOnPageSelected, paginatedDiscounts, selectedDiscountIds, setDiscountPendingDelete, toggleDiscountSelect, toggleSelectAllOnPage }) {
  return (
    <div className="border border-[#e2eaf4] rounded-2xl overflow-hidden bg-admin-surface">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed text-[13px] [&>thead>tr>th]:bg-[#f2f7ff] [&>thead>tr>th]:text-[#4a5c75] [&>thead>tr>th]:font-semibold [&>thead>tr>th]:p-[8px_6px] [&>thead>tr>th]:align-middle [&>tbody>tr>td]:p-[8px_6px] [&>tbody>tr>td]:align-middle [&>tbody>tr>td]:break-words [&>tbody>tr]:border-b [&>tbody>tr]:border-admin-line [&>tbody>tr]:transition-colors hover:[&>tbody>tr]:bg-[#f8fbff]">
          <thead>
            <tr>
              <th className="w-[5%] text-center">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả mã giảm giá trong trang"
                  checked={isAllOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                />
              </th>
              <th className="w-[20%]">Mã giảm giá</th>
              <th className="w-[23%]">Giá trị & điều kiện</th>
              <th className="w-[22%]">Hiệu lực</th>
              <th className="w-[12%] text-center">Trạng thái</th>
              <th className="w-[18%]">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedDiscounts.map((discount) => {
              const status = getDiscountStatus(discount);

              return (
                <tr key={discount._id}>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`Chọn mã giảm giá ${discount.code}`}
                      checked={selectedDiscountIds.includes(discount._id)}
                      onChange={() => toggleDiscountSelect(discount._id)}
                    />
                  </td>
                  <td>
                    <div className="font-bold text-admin-ink block break-words whitespace-normal" title={discount.code}>
                      {discount.code}
                    </div>
                    <div className="text-xs text-admin-muted mt-1 block break-words whitespace-normal">{discount.type === "percent" ? "Phần trăm" : "Số tiền"}</div>
                  </td>
                  <td>
                    <div className="grid gap-1 min-w-0">
                      <span className="inline-flex items-center rounded-full font-bold text-[11px] py-0.5 px-1.5 bg-[#e7f0ff] text-[#1749a6] w-max">
                        {discount.type === "percent"
                          ? `${discount.value}%`
                          : `${Number(discount.value).toLocaleString("vi-VN")} đ`}
                      </span>
                      <span className="text-xs text-admin-muted mt-1 block break-words whitespace-normal" title={`Đơn tối thiểu: ${Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ`}>
                        Đơn tối thiểu: {Number(discount.minOrderValue || 0).toLocaleString("vi-VN")} đ
                      </span>
                      <span className="text-xs text-admin-muted mt-1 block break-words whitespace-normal">
                        Số lượng còn lại: {getRemainingQuantity(discount).toLocaleString("vi-VN")}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1" title={`${formatDateTime(discount.startDate)} - ${formatDateTime(discount.endDate)}`}>
                      <div className="flex items-center gap-1.5 text-[13px] leading-tight start-date">
                        <span className="text-[9px] uppercase font-bold text-admin-muted w-8 shrink-0 whitespace-nowrap">Từ:</span>
                        <span className="text-[#334155] font-medium font-mono text-[11px]">{formatDateTime(discount.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] leading-tight end-date">
                        <span className="text-[9px] uppercase font-bold text-admin-muted w-8 shrink-0 whitespace-nowrap">Đến:</span>
                        <span className="text-[#334155] font-medium font-mono text-[11px]">{formatDateTime(discount.endDate)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="text-center">
                    <span
                      className={`inline-flex items-center rounded-full font-bold text-[11px] py-0.5 px-1.5 w-max ${
                        status === "Hết hạn"
                          ? "bg-[#ffe8e8] text-[#b42318]"
                          : status === "Sắp mở"
                            ? "bg-[#e8f1ff] text-[#1d4ed8]"
                          : status === "Hết mã"
                            ? "bg-[#fff3dd] text-[#b45309]"
                            : status === "Hoạt động"
                              ? "bg-[#e7f9ef] text-[#166534]"
                              : "bg-[#e8edf3] text-[#475569]"
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 flex-nowrap w-full">
                      <Link
                        to={`/admin/discounts/edit/${discount._id}`}
                        className="inline-flex items-center gap-1 py-1 px-2 text-[11px] font-semibold rounded-md border border-[#b5ccf0] bg-[#f6f9ff] text-[#0f3f84] hover:bg-[#e6efff] transition-colors shrink-0 whitespace-nowrap"
                        title="Chỉnh sửa mã giảm giá"
                      >
                        <FontAwesomeIcon icon={faPen} />
                        Sửa
                      </Link>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 py-1 px-2 text-[11px] font-semibold rounded-md border border-[#9a3412]/20 bg-admin-accent-soft text-[#9a3412] hover:bg-[#ffd9c7] transition-colors shrink-0 whitespace-nowrap"
                        onClick={() => setDiscountPendingDelete(discount)}
                        title="Xóa mã giảm giá"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedDiscounts.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-[#657589] p-6">
                  Không tìm thấy mã giảm giá phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DiscountTable;
