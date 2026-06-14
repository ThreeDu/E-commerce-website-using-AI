import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useNotification } from "../context/NotificationContext";

const ICON_MAP = {
  success: faCircleCheck,
  error: faCircleExclamation,
  warning: faTriangleExclamation,
  info: faCircleInfo,
};

const TYPE_STYLES = {
  success: { border: "border-l-status-success", icon: "text-status-success", bar: "bg-status-success" },
  error: { border: "border-l-status-error", icon: "text-status-error", bar: "bg-status-error" },
  warning: { border: "border-l-status-warning", icon: "text-status-warning", bar: "bg-status-warning" },
  info: { border: "border-l-status-info", icon: "text-status-info", bar: "bg-status-info" },
};

function StatusNotificationCenter() {
  const { notifications, dismiss } = useNotification();

  return (
    <div className="fixed top-[18px] right-[18px] z-[5000] flex flex-col gap-2.5 pointer-events-none max-[680px]:top-2.5 max-[680px]:right-2.5 max-[680px]:left-2.5 max-[680px]:items-center" aria-live="polite" aria-atomic="true">
      {notifications.map((item) => {
        const icon = ICON_MAP[item.type] || faCircleInfo;
        const styles = TYPE_STYLES[item.type] || TYPE_STYLES.info;
        return (
          <article key={item.id} className={`w-[min(400px,92vw)] bg-toast-bg rounded-[10px] shadow-[0_10px_26px_rgba(12,24,39,0.18)] border-l-[6px] ${styles.border} grid grid-cols-[auto_1fr_auto] gap-3 items-start relative overflow-hidden py-3.5 px-3.5 pb-4 pointer-events-auto animate-toast-slide-in max-[680px]:w-[min(100%,520px)] max-[680px]:animate-toast-slide-down`} role="status">
            <div className={`text-lg mt-px ${styles.icon}`} aria-hidden="true">
              <FontAwesomeIcon icon={icon} />
            </div>
            <div className="min-w-0">
              <p className="m-0 mb-0.5 text-[0.95rem] font-bold text-toast-text">{item.title}</p>
              <p className="m-0 text-[0.87rem] leading-[1.45] text-toast-subtext">{item.message}</p>
            </div>
            <button
              type="button"
              className="border-none bg-transparent text-[#9aa7b8] w-6 h-6 rounded-md inline-flex items-center justify-center cursor-pointer hover:text-[#334155] hover:bg-[#eef3f9]"
              onClick={() => dismiss(item.id)}
              aria-label="Đóng thông báo"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            {!item.sticky && item.duration > 0 ? (
              <div className="absolute left-0 right-0 bottom-0 h-[3px] bg-black/[0.04]" aria-hidden="true">
                <span
                  className={`toast-progress-bar ${styles.bar}`}
                  style={{ animationDuration: `${item.duration}ms` }}
                />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export default StatusNotificationCenter;
