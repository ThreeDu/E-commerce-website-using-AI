const { normalizeHintValue, extractJsonObjectFromText, formatConversationHistoryForPrompt, normalizeText } = require('./textUtils');

const LLM_TIMEOUT_MS = Number(process.env.CHATBOT_LLM_TIMEOUT_MS || 2500);

function toNumberOrNull(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

async function maybeParseQueryWithLlm(message, history = []) {
  const llmEnabled = String(process.env.CHATBOT_LLM_ENABLED || '').toLowerCase() === 'true';
  const parserEnabled =
    String(process.env.CHATBOT_LLM_QUERY_PARSER_ENABLED || 'true').toLowerCase() === 'true';
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || '').trim();
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || '').trim();
  const model = String(process.env.CHATBOT_LLM_MODEL || 'gpt-4.1-mini').trim();

  if (!llmEnabled || !parserEnabled || !apiUrl || !apiKey) {
    return null;
  }

  const isGemini = apiUrl.includes('generativelanguage.googleapis.com');
  const prompt = [
    'Extract shopping intent as strict JSON only.',
    'Return one JSON object with keys:',
    'intent, brand, series, model, product_line, storage, ram, price_min, price_max, confidence.',
    'Use null for unknown values.',
    'Do not include markdown or explanation.',
    'Use the conversation history to resolve short follow-up messages and inherit the product category, brand, or model from the previous turn when the current message is underspecified.',
    "If the current message is a budget-only follow-up like 'duoi 20 trieu', infer the implied category from history.",
    'If the current message asks about color or availability, use the latest referenced product from history.',
    `Conversation history:\n${formatConversationHistoryForPrompt(history, 6)}`,
    `User message: ${String(message || '')}`,
  ].join('\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const response = await (async () => {
      if (isGemini) {
        const endpoint = apiUrl.includes(':generateContent')
          ? apiUrl
          : `${apiUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
        const delimiter = endpoint.includes('?') ? '&' : '?';
        const requestUrl = `${endpoint}${delimiter}key=${encodeURIComponent(apiKey)}`;

        return fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0,
            },
          }),
        });
      }

      return fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    })();

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const content = isGemini
      ? (data?.candidates || [])
          .flatMap((candidate) => candidate?.content?.parts || [])
          .map((part) => String(part?.text || '').trim())
          .filter(Boolean)
          .join('\n')
      : data?.choices?.[0]?.message?.content;

    const parsed = extractJsonObjectFromText(content);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const normalized = {
      intent: String(parsed.intent || '').trim(),
      brand: normalizeHintValue(parsed.brand),
      series: normalizeHintValue(parsed.series),
      model: normalizeHintValue(parsed.model),
      product_line: normalizeHintValue(parsed.product_line || parsed.productLine),
      storage: normalizeHintValue(parsed.storage),
      ram: normalizeHintValue(parsed.ram),
      priceMin: toNumberOrNull(parsed.price_min ?? parsed.priceMin),
      priceMax: toNumberOrNull(parsed.price_max ?? parsed.priceMax),
      confidence: Number(parsed.confidence ?? 0),
    };

    return normalized;
  } catch (error) {
    return null;
  }
}

async function maybeGenerateLlmReply({ message, intent, recommendedProducts, history }) {
  const enabled = String(process.env.CHATBOT_LLM_ENABLED || '').toLowerCase() === 'true';
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || '').trim();
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || '').trim();
  const model = String(process.env.CHATBOT_LLM_MODEL || 'gpt-4.1-mini').trim();

  if (!enabled || !apiUrl || !apiKey) {
    return null;
  }

  const contextProducts = recommendedProducts.slice(0, 4).map((item) => ({
    name: item.name,
    category: item.category,
    price: item.price,
    reason: item.reason,
  }));

  const systemPrompt = intent === 'greeting'
    ? (() => {
        const variants = [
          'Chào mừng bạn quay trở lại! Mình đã chuẩn bị sẵn các ưu đãi đặc biệt dành riêng cho bạn — mời bạn xem các thẻ bên dưới.',
          'Rất vui được gặp lại bạn! Hôm nay có một số deal giảm sâu mình đã lọc sẵn, bạn xem nhanh ở phía dưới nhé.',
          'Chào bạn! Để tri ân sự quay trở lại, Tech Shop có một loạt ưu đãi giới hạn dành riêng cho bạn; mình đã sắp xếp chúng ở bên dưới.',
          'Xin chào! Mình đã chọn giúp bạn một số chương trình giảm giá đặc biệt trong hôm nay — bạn có thể xem các thẻ sản phẩm bên dưới.',
          'Chào bạn, hôm nay mình có một vài ưu đãi cực hời dành riêng cho bạn, mời bạn tham khảo các thẻ bên dưới.',
        ];

        return [
          'Bạn là trợ lý bán hàng e-commerce. Trả lời ngắn gọn, tự nhiên, ấm áp bằng tiếng Việt.',
          'Nhiệm vụ là chào người dùng và dẫn họ nhìn xuống các thẻ sản phẩm bên dưới.',
          'KHÔNG liệt kê tên sản phẩm hoặc nêu giá. Không dùng bullet. Không dài hơn 3 câu.',
          'Dưới đây là vài ví dụ phong cách (chỉ để cảm hứng, đừng sao chép y nguyên):',
          ...variants.map((v) => `- ${v}`),
        ].join(' ');
      })()
    : 'Bạn là trợ lý bán hàng e-commerce. Trả lời ngắn gọn bằng tiếng Việt, ưu tiên đề xuất hành động mua hàng, không bịa thông tin ngoài danh sách sản phẩm được cung cấp, và khi liệt kê sản phẩm thì mỗi sản phẩm một dòng, không dùng ký hiệu bullet.';

  const userPrompt = JSON.stringify(
    {
      intent,
      message,
      products: contextProducts,
      recentHistory: history.slice(-4),
      requirements: intent === 'greeting'
        ? 'Trả lời tối đa 3 câu. Chỉ chào hỏi và mời xem phần sản phẩm bên dưới. Không lặp lại tên sản phẩm hoặc giá sản phẩm trong câu trả lời.'
        : 'Trả lời tối đa 5 câu. Nếu cần, hỏi thêm 1 câu để làm rõ nhu cầu. Khi liệt kê sản phẩm: mỗi sản phẩm một dòng, không dùng ký hiệu bullet.',
    },
    null,
    2
  );

  const isGemini = apiUrl.includes('generativelanguage.googleapis.com');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const response = await (async () => {
      if (isGemini) {
        const endpoint = apiUrl.includes(':generateContent')
          ? apiUrl
          : `${apiUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
        const delimiter = endpoint.includes('?') ? '&' : '?';
        const requestUrl = `${endpoint}${delimiter}key=${encodeURIComponent(apiKey)}`;

        return fetch(requestUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              role: 'system',
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.4,
            },
          }),
        });
      }

      return fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
    })();

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    const content = isGemini
      ? (data?.candidates || [])
          .flatMap((candidate) => candidate?.content?.parts || [])
          .map((part) => String(part?.text || '').trim())
          .filter(Boolean)
          .join('\n')
      : data?.choices?.[0]?.message?.content;

    return String(content || '').trim() || null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  maybeParseQueryWithLlm,
  maybeGenerateLlmReply,
};
