import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "./AuthContext";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification as deleteNotificationApi,
} from "../services/userNotificationService";

const UserNotificationContext = createContext(null);

export function UserNotificationProvider({ children }) {
  const { auth, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollingIntervalRef = useRef(null);

  const token = auth?.token;

  const loadUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchUnreadCount(token);
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error("Error loading unread count:", err);
    }
  }, [token]);

  const loadNotifications = useCallback(async (page = 1, limit = 10) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(token, page, limit);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Error loading notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const markRead = useCallback(async (id) => {
    if (!token) return;
    try {
      const target = notifications.find((n) => n._id === id);
      const wasUnread = target ? !target.isRead : true;

      await markAsRead(id, token);

      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );

      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }, [token, notifications]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await markAllAsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  }, [token]);

  const removeNotification = useCallback(async (id) => {
    if (!token) return;
    try {
      const target = notifications.find((n) => n._id === id);
      const wasUnread = target ? !target.isRead : false;

      await deleteNotificationApi(id, token);

      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  }, [token, notifications]);

  // Polling unread count every 30s
  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (isAuthenticated && token) {
      loadUnreadCount();

      pollingIntervalRef.current = setInterval(() => {
        loadUnreadCount();
      }, 30000);
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isAuthenticated, token, loadUnreadCount]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      loadNotifications,
      loadUnreadCount,
      markRead,
      markAllRead,
      removeNotification,
    }),
    [
      notifications,
      unreadCount,
      loading,
      loadNotifications,
      loadUnreadCount,
      markRead,
      markAllRead,
      removeNotification,
    ]
  );

  return (
    <UserNotificationContext.Provider value={value}>
      {children}
    </UserNotificationContext.Provider>
  );
}

export function useUserNotification() {
  const context = useContext(UserNotificationContext);
  if (!context) {
    throw new Error("useUserNotification must be used within UserNotificationProvider");
  }
  return context;
}
