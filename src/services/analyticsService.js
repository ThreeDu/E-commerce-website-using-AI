const ANALYTICS_ANON_KEY = "analytics_anonymous_id";
const ANALYTICS_SESSION_KEY = "analytics_session_id";
const EVENT_DEDUPE_WINDOW_MS = 15000;
const RECENT_EVENT_CACHE = new Map();

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

function buildDedupeKey(eventName, pagePath, metadata, sessionId) {
  if (eventName !== "product_view") {
    return "";
  }

  const productId = String(metadata?.productId || "").trim();
  if (!productId) {
    return "";
  }

  return `${eventName}|${sessionId}|${pagePath}|${productId}`;
}

function isDuplicateEvent(dedupeKey) {
  if (!dedupeKey) {
    return false;
  }

  const now = Date.now();

  for (const [key, createdAt] of RECENT_EVENT_CACHE.entries()) {
    if (now - createdAt > EVENT_DEDUPE_WINDOW_MS) {
      RECENT_EVENT_CACHE.delete(key);
    }
  }

  const existing = RECENT_EVENT_CACHE.get(dedupeKey);
  if (existing && now - existing <= EVENT_DEDUPE_WINDOW_MS) {
    return true;
  }

  RECENT_EVENT_CACHE.set(dedupeKey, now);
  return false;
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

    const resolvedPagePath = pagePath || window.location.pathname;
    const sessionId = getSessionId();
    const dedupeKey = buildDedupeKey(eventName, resolvedPagePath, metadata, sessionId);

    if (isDuplicateEvent(dedupeKey)) {
      return;
    }

    await fetch("/api/analytics/events", {
      method: "POST",
      headers,
      body: JSON.stringify({
        eventName,
        anonymousId: getAnonymousId(),
        sessionId,
        pagePath: resolvedPagePath,
        source: "web",
        metadata,
      }),
    });
  } catch (error) {
    // Tracking failures should not block user actions.
  }
}
