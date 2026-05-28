import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useUserNotification } from "../../context/UserNotificationContext";
import "../../css/notification-bell.css";

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  );
}

function IconOrderBadge() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 13.5v-3h2.1l2.25 3H18z" />
    </svg>
  );
}

function IconDiscountBadge() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 8c-.83 0-1.5-.67-1.5-1.5S4.67 5 5.5 5 7 5.67 7 6.5 6.33 8 5.5 8z" />
    </svg>
  );
}

function IconCouponBadge() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-1.99.9-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2zm-4 4.25H8v-1.5h8v1.5zm0-3.5H8v-1.5h8v1.5zm0-3.5H8V7.75h8v1.5z" />
    </svg>
  );
}

function IconSystemBadge() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  );
}

function IconGiftBadge() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.62 0-2.95 1.29-3 2.9L12 4.06l-.02-.16C11.95 2.29 10.62 1 9 1c-1.66 0-3 1.34-3 3 0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-3c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-6 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h16v5z" />
    </svg>
  );
}

function IconCartBadge() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  );
}

const getNotificationIcon = (type) => {
  switch (type) {
    case "order_status":
      return <IconOrderBadge />;
    case "product_discount":
      return <IconDiscountBadge />;
    case "new_coupon":
      return <IconCouponBadge />;
    case "churn_intervention":
      return <IconGiftBadge />;
    case "abandoned_cart":
      return <IconCartBadge />;
    default:
      return <IconSystemBadge />;
  }
};

const getIconClass = (type) => {
  switch (type) {
    case "order_status":
      return "icon-order";
    case "product_discount":
      return "icon-discount";
    case "new_coupon":
      return "icon-coupon";
    case "churn_intervention":
      return "icon-gift";
    case "abandoned_cart":
      return "icon-cart";
    default:
      return "icon-system";
  }
};


const formatRelativeTime = (dateStr) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;
  if (diffDay === 1) return "Hôm qua";
  if (diffDay < 7) return `${diffDay} ngày trước`;

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function NotificationBell() {
  const { auth } = useAuth();
  const {
    notifications,
    unreadCount,
    loadNotifications,
    markRead,
    markAllRead,
    removeNotification,
  } = useUserNotification();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && auth?.token) {
      loadNotifications(1, 10);
    }
  }, [isOpen, auth?.token, loadNotifications]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleBellClick = () => {
    if (!auth) {
      navigate("/login");
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleNotificationClick = async (item) => {
    if (!item.isRead) {
      await markRead(item._id);
    }
    setIsOpen(false);
    
    if (item.type === "new_coupon") {
      navigate("/profile?openVoucher=true");
    } else if (item.link) {
      navigate(item.link);
    }
  };

  const handleDeleteClick = async (e, id) => {
    e.stopPropagation();
    await removeNotification(id);
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className={`notification-bell-trigger ${isOpen ? "active" : ""}`}
        onClick={handleBellClick}
        aria-label="Thông báo"
      >
        <IconBell />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Thông báo</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                className="mark-all-read-btn"
                onClick={markAllRead}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <IconBell />
                <p>Không có thông báo mới</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id}
                  className={`notification-item ${!item.isRead ? "unread" : ""}`}
                  onClick={() => handleNotificationClick(item)}
                >
                  <div className={`notification-item-icon ${getIconClass(item.type)}`}>
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="notification-item-content">
                    <div className="notification-item-title-row">
                      <span className="notification-item-title">{item.title}</span>
                      <button
                        type="button"
                        className="notification-item-delete"
                        onClick={(e) => handleDeleteClick(e, item._id)}
                        title="Xóa"
                      >
                        <IconTrash />
                      </button>
                    </div>
                    <p className="notification-item-message">{item.message}</p>
                    <span className="notification-item-time">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
