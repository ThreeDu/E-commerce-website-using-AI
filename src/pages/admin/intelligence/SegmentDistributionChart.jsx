import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUserFriends } from "@fortawesome/free-solid-svg-icons";
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

function SegmentDistributionChart({ overview, segmentChartData, segmentNames, segments }) {
  if (!segments?.distribution) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 mb-6">
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs">
        <h3 className="m-0 mb-4 text-base font-bold text-[#1e293b] flex items-center gap-2">
          <FontAwesomeIcon icon={faUserFriends} className="text-admin-primary" />
          Phân khúc khách hàng (RFM Segmentation)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={segmentChartData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
              >
                {segmentChartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value} Khách hàng`, 'Số lượng']} />
            </PieChart>
          </ResponsiveContainer>

          <div className="flex flex-col gap-3">
            {Object.keys(segmentNames).map(key => {
              const count = segments.distribution[key] || 0;
              const percentage = overview?.total_customers ? ((count / overview.total_customers) * 100).toFixed(1) : 0;
              return (
                <div key={key} className="flex items-center justify-between text-sm border-b border-[#f1f5f9] pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 height-2.5 rounded-full" style={{ backgroundColor: segmentNames[key].color, height: "10px", width: "10px" }} />
                    <strong className="text-[#334155]">{segmentNames[key].label}</strong>
                  </div>
                  <span className="text-admin-muted font-semibold">
                    {count} KH ({percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SegmentDistributionChart;
