function ProductFilters({ categoryLevel1, categoryLevel2, categoryLevel3, handleCategoryLevel1Change, handleCategoryLevel2Change, level1Options, level2Options, level3Options, priceSort, searchTerm, setCategoryLevel3, setPriceSort, setSearchTerm, setStatusFilter, statusFilter }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3.5 mb-5.5 items-end">
      <div className="grid gap-2 min-w-0 col-span-1 sm:col-span-2">
        <label htmlFor="product-search" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Tìm kiếm</label>
        <input
          id="product-search"
          type="text"
          placeholder="Tên sản phẩm hoặc danh mục..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)]"
        />
      </div>

      <div className="grid gap-2 min-w-0">
        <label htmlFor="product-category-level-1" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Danh mục cấp 1</label>
        <select
          id="product-category-level-1"
          value={categoryLevel1}
          onChange={(event) => handleCategoryLevel1Change(event.target.value)}
          className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
        >
          <option value="all">Tất cả cấp 1</option>
          {level1Options.map((category) => (
            <option key={category._id} value={category._id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {categoryLevel1 !== "all" && (
        <div className="grid gap-2 min-w-0">
          <label htmlFor="product-category-level-2" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Danh mục cấp 2</label>
          <select
            id="product-category-level-2"
            value={categoryLevel2}
            onChange={(event) => handleCategoryLevel2Change(event.target.value)}
            className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
          >
            <option value="all">Tất cả cấp 2</option>
            {level2Options.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {categoryLevel2 !== "all" && (
        <div className="grid gap-2 min-w-0">
          <label htmlFor="product-category-level-3" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Danh mục cấp 3</label>
          <select
            id="product-category-level-3"
            value={categoryLevel3}
            onChange={(event) => setCategoryLevel3(event.target.value)}
            className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
          >
            <option value="all">Tất cả cấp 3</option>
            {level3Options.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-2 min-w-0">
        <label htmlFor="product-price-sort" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Sắp xếp giá</label>
        <select
          id="product-price-sort"
          value={priceSort}
          onChange={(event) => setPriceSort(event.target.value)}
          className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
        >
          <option value="default">Mặc định</option>
          <option value="asc">Giá thấp đến cao</option>
          <option value="desc">Giá cao đến thấp</option>
        </select>
      </div>

      <div className="grid gap-2 min-w-0">
        <label htmlFor="product-status" className="text-[12px] uppercase tracking-wider text-[#6b7a8d] font-bold block mb-1">Trạng thái kho</label>
        <select
          id="product-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-[42px] rounded-xl border border-[#d7e1ed] px-3.25 bg-white w-full text-sm focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="in-stock">Còn hàng</option>
          <option value="low-stock">Sắp hết</option>
          <option value="out-stock">Hết hàng</option>
        </select>
      </div>
    </div>
  );
}

export default ProductFilters;
