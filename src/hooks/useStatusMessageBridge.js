import { useEffect, useRef } from "react";
import { useNotification } from "../context/NotificationContext";

function inferTypeFromMessage(message) {
  const text = String(message || "").toLowerCase();

  const hasSuccessSignal = /thanh cong|thành công|da |đã /.test(text);
  const hasErrorSignal = /khong the|không thể|loi|lỗi|that bai|thất bại|khong duoc|không được/.test(text);
  const hasWarningSignal = /canh bao|cảnh báo|sap het|sắp hết|het han|hết hạn/.test(text);

  if ((hasSuccessSignal && hasErrorSignal) || hasWarningSignal) {
    return "warning";
  }

  if (hasErrorSignal) {
    return "error";
  }

  if (hasSuccessSignal) {
    return "success";
  }

  return "info";
}

export function useStatusMessageBridge(
  message,
  {
    title,
    duration = 4500,
    type,
  } = {}
) {
  const previousMessageRef = useRef("");
  const { success, error, warning, info } = useNotification();

  useEffect(() => {
    const content = String(message || "").trim();

    if (!content) {
      previousMessageRef.current = "";
      return;
    }

    if (content === previousMessageRef.current) {
      return;
    }

    previousMessageRef.current = content;

    const finalType = type || inferTypeFromMessage(content);

    if (finalType === "success") {
      success(content, { title: title || "Thành công", duration });
      return;
    }

    if (finalType === "error") {
      error(content, { title: title || "Lỗi", duration });
      return;
    }

    if (finalType === "warning") {
      warning(content, { title: title || "Cảnh báo", duration });
      return;
    }

    info(content, { title: title || "Thông báo", duration });
  }, [message, title, duration, type, success, error, warning, info]);
}
