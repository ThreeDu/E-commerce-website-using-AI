const crypto = require("crypto");

const MAX_SESSION_IDLE_MS = 1000 * 60 * 30;

const sessionStore = new Map();

function cleanupOldSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - Number(session.updatedAt || 0) > MAX_SESSION_IDLE_MS) {
      sessionStore.delete(sessionId);
    }
  }
}

function getOrCreateSession(sessionId) {
  cleanupOldSessions();
  const key = String(sessionId || "").trim() || crypto.randomUUID();

  if (!sessionStore.has(key)) {
    sessionStore.set(key, {
      id: key,
      history: [],
      updatedAt: Date.now(),
    });
  }

  const session = sessionStore.get(key);
  session.updatedAt = Date.now();
  return session;
}

function getSessionMemory(session) {
  if (!session.memory || typeof session.memory !== "object") {
    session.memory = {};
  }

  return session.memory;
}

function updateSessionMemory(session, updates) {
  const memory = getSessionMemory(session);
  const next = { ...memory };

  if (updates?.budget != null) {
    next.budget = Number(updates.budget);
  }

  if (updates?.category) {
    next.category = String(updates.category);
  }

  if (updates?.brand) {
    next.brand = String(updates.brand);
  }

  if (updates?.series) {
    next.series = String(updates.series);
  }

  if (updates?.model) {
    next.model = String(updates.model);
  }

  if (updates?.selectedProductId) {
    next.selectedProductId = String(updates.selectedProductId);
  }

  if (updates?.selectedProductName) {
    next.selectedProductName = String(updates.selectedProductName);
  }

  if (updates?.selectedProductVariant) {
    next.selectedProductVariant = String(updates.selectedProductVariant);
  }

  next.updatedAt = Date.now();
  session.memory = next;
  return next;
}

module.exports = {
  cleanupOldSessions,
  getOrCreateSession,
  getSessionMemory,
  updateSessionMemory,
};
