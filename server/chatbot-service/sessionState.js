const crypto = require("crypto");

const ChatbotEvent = require("./models/ChatbotEvent");

const MAX_SESSION_IDLE_MS = 1000 * 60 * 30;
const KNN_CACHE_TTL_MS = 1000 * 60 * 3;

const sessionStore = new Map();
const knnCache = {
  expiresAt: 0,
  productActorWeights: new Map(),
  actorProductWeights: new Map(),
};

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

function buildActorKey({ userId, sessionId }) {
  const uid = String(userId || "").trim();
  if (uid) {
    return `u:${uid}`;
  }

  const sid = String(sessionId || "").trim();
  if (sid) {
    return `s:${sid}`;
  }

  return "";
}

function getEventWeight(eventType) {
  if (eventType === "cart") {
    return 3;
  }

  if (eventType === "click") {
    return 2;
  }

  if (eventType === "view") {
    return 1.3;
  }

  if (eventType === "impression") {
    return 0.5;
  }

  if (eventType === "message") {
    return 0.4;
  }

  return 1;
}

async function refreshKnnCache() {
  if (Date.now() < knnCache.expiresAt) {
    return;
  }

  const sevenDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);

  const events = await ChatbotEvent.find({
    product: { $ne: null },
    eventType: { $in: ["view", "click", "cart", "impression"] },
    createdAt: { $gte: sevenDaysAgo },
  })
    .sort({ createdAt: -1 })
    .limit(10000)
    .select("sessionId user eventType product")
    .lean();

  const productActorWeights = new Map();
  const actorProductWeights = new Map();

  events.forEach((event) => {
    const productId = String(event.product || "").trim();
    if (!productId) {
      return;
    }

    const actorKey = buildActorKey({
      userId: event.user,
      sessionId: event.sessionId,
    });

    if (!actorKey) {
      return;
    }

    const weight = getEventWeight(event.eventType);

    const actorMap = productActorWeights.get(productId) || new Map();
    actorMap.set(actorKey, Number(actorMap.get(actorKey) || 0) + weight);
    productActorWeights.set(productId, actorMap);

    const productMap = actorProductWeights.get(actorKey) || new Map();
    productMap.set(productId, Number(productMap.get(productId) || 0) + weight);
    actorProductWeights.set(actorKey, productMap);
  });

  knnCache.productActorWeights = productActorWeights;
  knnCache.actorProductWeights = actorProductWeights;
  knnCache.expiresAt = Date.now() + KNN_CACHE_TTL_MS;
}

function computeKnnScores(seedProductIds = []) {
  const scores = new Map();
  const productActorWeights = knnCache.productActorWeights;
  const actorProductWeights = knnCache.actorProductWeights;
  const seedSet = new Set(seedProductIds.map((item) => String(item)));

  seedSet.forEach((seedId) => {
    const seedActors = productActorWeights.get(seedId);
    if (!seedActors) {
      return;
    }

    let seedNorm = 0;
    seedActors.forEach((weight) => {
      seedNorm += weight * weight;
    });

    const seedNormRoot = Math.sqrt(seedNorm || 1);
    const dotByCandidate = new Map();

    seedActors.forEach((seedWeight, actorKey) => {
      const actorProducts = actorProductWeights.get(actorKey);
      if (!actorProducts) {
        return;
      }

      actorProducts.forEach((otherWeight, candidateId) => {
        if (candidateId === seedId) {
          return;
        }

        dotByCandidate.set(
          candidateId,
          Number(dotByCandidate.get(candidateId) || 0) + seedWeight * otherWeight
        );
      });
    });

    dotByCandidate.forEach((dot, candidateId) => {
      const candidateActors = productActorWeights.get(candidateId);
      if (!candidateActors) {
        return;
      }

      let candidateNorm = 0;
      candidateActors.forEach((weight) => {
        candidateNorm += weight * weight;
      });

      const similarity = dot / ((seedNormRoot || 1) * Math.sqrt(candidateNorm || 1));
      scores.set(candidateId, Number(scores.get(candidateId) || 0) + similarity);
    });
  });

  return scores;
}

function invalidateKnnCache() {
  knnCache.expiresAt = 0;
}

module.exports = {
  cleanupOldSessions,
  getOrCreateSession,
  getSessionMemory,
  updateSessionMemory,
  refreshKnnCache,
  computeKnnScores,
  invalidateKnnCache,
};
