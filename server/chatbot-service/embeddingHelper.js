/**
 * embeddingHelper.js — Generates vector embeddings for RAG semantic search.
 * Supports Gemini embedding API (text-embedding-004) and OpenAI (text-embedding-3-small).
 */

async function generateEmbedding(text) {
  const apiUrl = process.env.EMBEDDING_API_URL || process.env.CHATBOT_LLM_GEMINI_URL || 'https://generativelanguage.googleapis.com';
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.CHATBOT_LLM_GEMINI_KEY || '';
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-004';

  if (!apiKey) {
    console.warn('[Embedding] No API key found, skipping vector embedding');
    return null;
  }

  const isGemini = apiUrl.includes('generativelanguage.googleapis.com');

  try {
    if (isGemini) {
      const url = `${apiUrl.replace(/\/+$/, '')}/v1beta/models/${model}:embedContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text: String(text || '').substring(0, 2048) }] },
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Embedding] Gemini API error (${res.status}): ${errText}`);
        return null;
      }

      const data = await res.json();
      return data?.embedding?.values || null;
    } else {
      const url = `${apiUrl.replace(/\/+$/, '')}/v1/embeddings`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: String(text || '').substring(0, 2048),
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[Embedding] OpenAI API error (${res.status}): ${errText}`);
        return null;
      }

      const data = await res.json();
      return data?.data?.[0]?.embedding || null;
    }
  } catch (error) {
    console.warn('[Embedding] Exception generating vector:', error.message);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vector arrays.
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = { generateEmbedding, cosineSimilarity };
