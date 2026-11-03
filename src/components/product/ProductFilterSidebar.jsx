function ProductFilterSidebar({ categoryLevel1, categoryLevel2, categoryLevel3, level1Categories, level2Categories, level3Categories, maxPossiblePrice, maxPrice, setCategoryLevel1, setCategoryLevel2, setCategoryLevel3, setMaxPrice, setSortBy, sortBy }) {
  return (
    <aside className="sticky top-[86px] self-start p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs max-[960px]:static">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
        <h3 className="m-0 text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
          <span>⚙️</span>
          <span>Bộ lọc tìm kiếm</span>
        </h3>
        {(categoryLevel1 !== "all" || sortBy !== "best-selling" || maxPrice < maxPossiblePrice) && (
          <button
            type="button"
            onClick={() => {
              setCategoryLevel1("all");
              setCategoryLevel2("all");
              setCategoryLevel3("all");
              setSortBy("best-selling");
              setMaxPrice(maxPossiblePrice);
            }}
            className="text-[11px] text-teal-700 hover:text-teal-800 font-bold border-none bg-transparent cursor-pointer p-0"
          >
            Đặt lại
          </button>
        )}
      </div>

      {/* Sắp xếp */}
      <div className="grid gap-1.5 mb-4">
        <label className="text-xs font-bold text-slate-700">Sắp xếp theo</label>
        <select
          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="best-selling">Bán chạy nhất</option>
          <option value="most-viewed">Xem nhiều nhất</option>
          <option value="top-rated">Đánh giá cao nhất</option>
        </select>
      </div>

      {/* Danh mục 3 cấp */}
      <div className="grid gap-1.5 mb-4">
        <label className="text-xs font-bold text-slate-700">Danh mục sản phẩm</label>
        <select
          className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all"
          value={categoryLevel1}
          onChange={(event) => {
            const nextValue = event.target.value;
            setCategoryLevel1(nextValue);
            setCategoryLevel2("all");
            setCategoryLevel3("all");
          }}
        >
          <option value="all">Tất cả danh mục</option>
          {level1Categories.map((cat) => (
            <option key={cat._id} value={String(cat._id)}>
              {cat.name}
            </option>
          ))}
        </select>

        {categoryLevel1 !== "all" && (
          <select
            className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all mt-1.5"
            value={categoryLevel2}
            onChange={(event) => {
              const nextValue = event.target.value;
              setCategoryLevel2(nextValue);
              setCategoryLevel3("all");
            }}
          >
            <option value="all">Tất cả thương hiệu</option>
            {level2Categories.map((cat) => (
              <option key={cat._id} value={String(cat._id)}>
                {cat.name}
              </option>
            ))}
          </select>
        )}

        {categoryLevel2 !== "all" && level3Categories.length > 0 && (
          <select
            className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-100 transition-all mt-1.5"
            value={categoryLevel3}
            onChange={(event) => setCategoryLevel3(event.target.value)}
          >
            <option value="all">Tất cả dòng sản phẩm</option>
            {level3Categories.map((cat) => (
              <option key={cat._id} value={String(cat._id)}>
                {cat.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Mức giá */}
      <div className="grid gap-1.5 mb-2">
        <label className="text-xs font-bold text-slate-700">Mức giá tối đa</label>
        <input
          className="w-full accent-teal-700 cursor-pointer"
          type="range"
          min="0"
          max={maxPossiblePrice}
          step={Math.max(10000, Math.round(maxPossiblePrice / 200))}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
        <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold mt-1">
          <span>0 đ</span>
          <span className="text-teal-700 font-bold">{maxPrice.toLocaleString("vi-VN")} đ</span>
        </div>
      </div>
    </aside>
  );
}

export default ProductFilterSidebar;
