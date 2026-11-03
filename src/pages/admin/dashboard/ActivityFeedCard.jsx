import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";

function formatRelativeTime(value) {
  if (!value) return "Không rõ thời gian";
  const now = Date.now();
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return "Không rõ thời gian";

  const diffMinutes = Math.max(0, Math.floor((now - target) / 60000));
  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

function ActivityFeedCard({ activities }) {
  return (
    <article className="admin-card p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-admin-line">
        <div>
          <h2 className="text-base font-bold text-admin-ink m-0 flex items-center gap-2">
            <FontAwesomeIcon icon={faClock} className="text-blue-600" />
            Hoạt động gần đây
          </h2>
          <span className="text-xs text-admin-muted">
            Dòng thời gian sự kiện mới nhất
          </span>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {activities.length} sự kiện
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {activities.length > 0 ? (
          activities.map((act) => (
            <div
              key={act.key}
              className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  act.type === "order"
                    ? "bg-emerald-500"
                    : act.type === "cancel"
                    ? "bg-rose-500"
                    : "bg-amber-500"
                }`} />
                <div className="truncate">
                  <div className="font-bold text-slate-800 truncate" title={act.action}>
                    {act.action}
                  </div>
                  <div className="text-slate-500 text-[11px] truncate">
                    {act.actor}
                  </div>
                </div>
              </div>

              <span className="text-slate-400 font-medium shrink-0 whitespace-nowrap text-[11px]">
                {formatRelativeTime(act.time)}
              </span>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-xs text-admin-muted">
            Chưa có hoạt động gần đây để hiển thị.
          </div>
        )}
      </div>
    </article>
  );
}

export default ActivityFeedCard;
