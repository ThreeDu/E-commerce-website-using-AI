import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const NotificationContext = createContext(null);

const DEFAULT_DURATION = 5000;

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timeout = timersRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timersRef.current.delete(id);
    }

    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    ({
      type = "info",
      title = "Thông báo",
      message = "",
      duration = DEFAULT_DURATION,
      sticky = false,
    }) => {
      const id = createId();

      setNotifications((prev) => [
        ...prev,
        {
          id,
          type,
          title,
          message,
          duration,
          sticky,
        },
      ]);

      if (!sticky && duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, duration);

        timersRef.current.set(id, timeout);
      }

      return id;
    },
    [dismiss]
  );

  const clear = useCallback(() => {
    timersRef.current.forEach((timeout) => clearTimeout(timeout));
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  const success = useCallback(
    (message, options = {}) =>
      push({
        type: "success",
        title: options.title || "Thành công",
        message,
        duration: options.duration ?? DEFAULT_DURATION,
        sticky: options.sticky || false,
      }),
    [push]
  );

  const error = useCallback(
    (message, options = {}) =>
      push({
        type: "error",
        title: options.title || "Lỗi",
        message,
        duration: options.duration ?? DEFAULT_DURATION,
        sticky: options.sticky || false,
      }),
    [push]
  );

  const warning = useCallback(
    (message, options = {}) =>
      push({
        type: "warning",
        title: options.title || "Cảnh báo",
        message,
        duration: options.duration ?? DEFAULT_DURATION,
        sticky: options.sticky || false,
      }),
    [push]
  );

  const info = useCallback(
    (message, options = {}) =>
      push({
        type: "info",
        title: options.title || "Thông tin",
        message,
        duration: options.duration ?? DEFAULT_DURATION,
        sticky: options.sticky || false,
      }),
    [push]
  );

  useEffect(() => {
    const timerMap = timersRef.current;

    return () => {
      timerMap.forEach((timeout) => clearTimeout(timeout));
      timerMap.clear();
    };
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      push,
      dismiss,
      clear,
      success,
      error,
      warning,
      info,
    }),
    [notifications, push, dismiss, clear, success, error, warning, info]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }

  return context;
}
