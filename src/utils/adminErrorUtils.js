export function getErrorMessage(error, fallbackMessage) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error?.message && String(error.message).trim()) {
    return String(error.message);
  }

  return fallbackMessage;
}
