import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp, faSortAmountDown, faSearch, faFilter } from "@fortawesome/free-solid-svg-icons";

function CustomerTableToolbar({ handleOrderToggle, handleSortChange, searchTerm, segmentNames, selectedSegment, setCurrentPage, setSearchTerm, setSelectedSegment, sortBy, sortOrder }) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-5 w-full">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex items-center">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 text-admin-muted text-sm" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 pr-3 py-2 border border-admin-line rounded-xl text-sm bg-[#f8fafc] text-admin-ink w-full sm:w-[260px] transition-all duration-300 focus:outline-none focus:bg-white focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] focus:w-full sm:focus:w-[300px]"
          />
        </div>

        {/* Segment Filter */}
        <div className="flex items-center gap-1.5">
          <FontAwesomeIcon icon={faFilter} className="text-admin-muted text-xs" />
          <select
            value={selectedSegment}
            onChange={(e) => {
              setSelectedSegment(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full border border-admin-line rounded-xl p-[8px_11px] text-sm bg-white focus:outline-none focus:border-admin-primary focus:shadow-[0_0_0_4px_rgba(15,118,110,0.13)] admin-select-styled cursor-pointer"
          >
            <option value="">Tất cả phân khúc</option>
            {Object.keys(segmentNames).map((key) => (
              <option key={key} value={key}>
                {segmentNames[key].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[13px] text-admin-muted">
          <FontAwesomeIcon icon={faSortAmountDown} className="mr-1 text-admin-muted" />
          Sắp xếp:
        </label>
        <select
          value={sortBy}
          onChange={handleSortChange}
          className="border border-[#cbd5e1] rounded-lg p-[6px_10px] text-[13px] bg-white focus:outline-none focus:border-admin-primary"
        >
          <option value="churn_score">Churn Risk</option>
          <option value="potential_score">Potential Score</option>
          <option value="clv_score">CLV Score</option>
          <option value="predicted_spend">Chi tiêu dự đoán</option>
          <option value="monetary">Chi tiêu</option>
          <option value="recency_days">Lần cuối</option>
          <option value="frequency">Tần suất</option>
        </select>
        <button
          type="button"
          onClick={handleOrderToggle}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white text-xs font-bold text-admin-ink hover:bg-[#f8fafc] transition-all cursor-pointer"
        >
          {sortOrder === "desc" ? (
            <>
              <FontAwesomeIcon icon={faArrowDown} className="text-red-500" />
              Giảm dần
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faArrowUp} className="text-admin-success" />
              Tăng dần
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default CustomerTableToolbar;
