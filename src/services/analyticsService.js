const ANALYTICS_ANON_KEY = "analytics_anonymous_id";
const ANALYTICS_SESSION_KEY = "analytics_session_id";

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateStorageValue(storage, key, prefix) {
  try {
    const existing = storage.getItem(key);
    if (existing) {
      return existing;
    }

    const nextValue = createId(prefix);
    storage.setItem(key, nextValue);
    return nextValue;
  } catch (error) {
    return createId(prefix);
  }
}

export function getAnonymousId() {
  return getOrCreateStorageValue(window.localStorage, ANALYTICS_ANON_KEY, "anon");
}

export function getSessionId() {
  return getOrCreateStorageValue(window.sessionStorage, ANALYTICS_SESSION_KEY, "session");
}

export async function trackEvent({ eventName, pagePath, metadata = {}, token }) {
  try {
    if (!eventName) {
      return;
    }

    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await fetch("/api/analytics/events", {
      method: "POST",
      headers,
      body: JSON.stringify({
        eventName,
        anonymousId: getAnonymousId(),
        sessionId: getSessionId(),
        pagePath: pagePath || window.location.pathname,
        source: "web",
        metadata,
      }),
    });
  } catch (error) {
    // Tracking failures should not block user actions.
  }
}
