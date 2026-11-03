import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faTriangleExclamation, faCircleXmark, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";

function AlertsCard({ alerts }) {
  return (
    <article className="admin-card p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-admin-line">
        <div>
          <h2 className="text-base font-bold text-admin-ink m-0 flex items-center gap-2">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500" />
            Cảnh báo cần xử lý
          </h2>
          <span className="text-xs text-admin-muted">
            Các vấn đề ưu tiên cần admin kiểm tra
          </span>
        </div>
        <Link
          to="/admin/notifications"
          className="text-xs font-bold text-admin-primary hover:underline"
        >
          Xem tất cả
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {alerts.map((alert) => {
          const isDanger = alert.level === "danger";
          const isWarning = alert.level === "warning";

          return (
            <div
              key={alert.key || alert.title}
              className={`p-3.5 rounded-xl border transition-all ${
                isDanger
                  ? "bg-rose-50/70 border-rose-200"
                  : isWarning
                  ? "bg-amber-50/70 border-amber-200"
                  : "bg-blue-50/70 border-blue-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    <FontAwesomeIcon
                      icon={isDanger ? faCircleXmark : isWarning ? faTriangleExclamation : faCircleInfo}
                      className={isDanger ? "text-rose-600" : isWarning ? "text-amber-600" : "text-blue-600"}
                    />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold m-0 leading-tight ${
                      isDanger ? "text-rose-900" : isWarning ? "text-amber-900" : "text-blue-900"
                    }`}>
                      {alert.title}
                    </h3>
                    <p className="text-xs text-slate-600 m-0 mt-1 leading-relaxed">
                      {alert.description}
                    </p>
                  </div>
                </div>

                <Link
                  to={alert.to}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                    isDanger
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : isWarning
                      ? "bg-amber-600 text-white hover:bg-amber-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <span>Xử lý</span>
                  <FontAwesomeIcon icon={faChevronRight} className="text-[9px]" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default AlertsCard;
