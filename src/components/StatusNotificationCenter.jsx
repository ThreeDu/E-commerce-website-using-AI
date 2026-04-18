import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useNotification } from "../context/NotificationContext";
import "../css/notification-center.css";

const ICON_MAP = {
  success: faCircleCheck,
  error: faCircleExclamation,
  warning: faTriangleExclamation,
  info: faCircleInfo,
};

function StatusNotificationCenter() {
  const { notifications, dismiss } = useNotification();

  return (
    <div className="status-toast-container" aria-live="polite" aria-atomic="true">
      {notifications.map((item) => {
        const icon = ICON_MAP[item.type] || faCircleInfo;
        return (
          <article key={item.id} className={`status-toast ${item.type}`} role="status">
            <div className="status-toast-icon" aria-hidden="true">
              <FontAwesomeIcon icon={icon} />
            </div>
            <div className="status-toast-content">
              <p className="status-toast-title">{item.title}</p>
              <p className="status-toast-message">{item.message}</p>
            </div>
            <button
              type="button"
              className="status-toast-close"
              onClick={() => dismiss(item.id)}
              aria-label="Đóng thông báo"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            {!item.sticky && item.duration > 0 ? (
              <div className="status-toast-progress-track" aria-hidden="true">
                <span
                  className="status-toast-progress-bar"
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
