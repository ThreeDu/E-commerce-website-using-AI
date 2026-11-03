function DiscountFilters({ activeFilter, remainingFilter, searchTerm, setActiveFilter, setRemainingFilter, setSearchTerm, setTimeFilter, setTypeFilter, setValueFilter, timeFilter, typeFilter, valueFilter }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 mb-4">
      <div className="sm:col-span-2 lg:col-span-2 flex flex-col gap-1.5">
        <label htmlFor="discount-search" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Tìm kiếm</label>
        <input
          id="discount-search"
          type="text"
          className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
          placeholder="Mã giảm giá hoặc loại mã..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="discount-type" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Danh mục</label>
        <select
          id="discount-type"
          className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="all">Tất cả loại mã</option>
          <option value="percent">Phần trăm</option>
          <option value="fixed">Số tiền</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="discount-value" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Mức giảm</label>
        <select
          id="discount-value"
          className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
          value={valueFilter}
          onChange={(event) => setValueFilter(event.target.value)}
        >
          <option value="all">Tất cả mức giảm</option>
          <option value="under10">Dưới 10</option>
          <option value="from10To30">10 - 30</option>
          <option value="over30">Trên 30</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="discount-active" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Hoạt động</label>
        <select
          id="discount-active"
          className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value)}
        >
          <option value="all">Tất cả</option>
          <option value="active">Đang bật</option>
          <option value="inactive">Đang tắt</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="discount-time" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Thời gian hiệu lực</label>
        <select
          id="discount-time"
          className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
          value={timeFilter}
          onChange={(event) => setTimeFilter(event.target.value)}
        >
          <option value="all">Tất cả</option>
          <option value="running">Đang hiệu lực</option>
          <option value="upcoming">Sắp mở</option>
          <option value="expired">Hết hạn</option>
          <option value="no-window">Không giới hạn thời gian</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="discount-remaining" className="text-[11px] font-bold uppercase tracking-wider text-admin-muted">Số lượt còn lại</label>
        <select
          id="discount-remaining"
          className="w-full border border-admin-line rounded-xl p-[10px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
          value={remainingFilter}
          onChange={(event) => setRemainingFilter(event.target.value)}
        >
          <option value="all">Tất cả</option>
          <option value="has-remaining">Còn lượt dùng</option>
          <option value="out-of-code">Đã hết lượt</option>
        </select>
      </div>
    </div>
  );
}

export default DiscountFilters;
