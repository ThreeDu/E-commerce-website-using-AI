import { useEffect, useRef } from "react";
import { useNotification } from "../context/NotificationContext";

function inferTypeFromMessage(content) {
	const normalized = String(content || "").toLowerCase();

	if (
		normalized.includes("không thể") ||
		normalized.includes("that bai") ||
		normalized.includes("thất bại") ||
		normalized.includes("lỗi") ||
		normalized.includes("error")
	) {
		return "error";
	}

	if (
		normalized.includes("cảnh báo") ||
		normalized.includes("canh bao") ||
		normalized.includes("chú ý") ||
		normalized.includes("chu y") ||
		normalized.includes("warning")
	) {
		return "warning";
	}

	return "success";
}

export function useStatusMessageBridge(message, options = {}) {
	const { success, error, warning, info } = useNotification();
	const previousMessageRef = useRef("");

	useEffect(() => {
		const content = String(message || "").trim();
		if (!content) {
			previousMessageRef.current = "";
			return;
		}

		if (previousMessageRef.current === content) {
			return;
		}

		previousMessageRef.current = content;

		const finalType = options.type || inferTypeFromMessage(content);
		const notificationOptions = {
			title: options.title,
			duration: options.duration,
		};

		if (finalType === "error") {
			error(content, notificationOptions);
			return;
		}

		if (finalType === "warning") {
			warning(content, notificationOptions);
			return;
		}

		if (finalType === "info") {
			info(content, notificationOptions);
			return;
		}

		success(content, notificationOptions);
	}, [error, info, message, options.duration, options.title, options.type, success, warning]);
}

export default useStatusMessageBridge;
