const { normalizeHintValue, extractJsonObjectFromText, formatConversationHistoryForPrompt, normalizeText } = require('./textUtils');

const LLM_TIMEOUT_MS = Number(process.env.CHATBOT_LLM_TIMEOUT_MS || 10000);

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

  const compareService = require('./compare');
  const contextProducts = recommendedProducts.slice(0, 4).map((item) => {
    const specs = compareService.extractComparisonSpecSummary(item);
    return {
      name: item.name,
      category: item.category,
      price: item.price,
      reason: item.reason,
      specs: {
        chip: specs.chip,
        ram: specs.ram,
        rom: specs.rom,
        screen: specs.screen,
        camera: specs.camera,
        battery: specs.battery,
        gpu: specs.gpu,
        weight: specs.weight,
        os: specs.os,
        isLaptop: specs.isLaptop
      },
      description: item.description || '',
    };
  });

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
    : 'Bạn là chuyên gia tư vấn bán hàng e-commerce chuyên nghiệp. Hãy trả lời tự nhiên, thân thiện bằng tiếng Việt.\n' +
      'Dưới đây là các công cụ (Tools/Functions) bạn có thể sử dụng để hỗ trợ khách hàng:\n' +
      '- `addToCart`: Gọi hàm này khi khách hàng yêu cầu thêm sản phẩm vào giỏ hàng (ví dụ: "Thêm sản phẩm này vào giỏ", "mua sản phẩm Samsung S26 Ultra", v.v.). Hãy đối chiếu và chọn sản phẩm phù hợp nhất từ danh sách `products` được cung cấp dưới đây để lấy ID tương ứng làm tham số `productId`.\n' +
      '- `getOrderStatus`: Gọi hàm này khi khách hàng muốn kiểm tra hoặc theo dõi đơn hàng của họ (ví dụ: "đơn hàng mới nhất thế nào rồi", "tra cứu đơn hàng", v.v.).\n' +
      'Hãy dựa vào thông tin chi tiết (Chip, Camera, Pin, RAM, ROM) của các sản phẩm để tư vấn chính xác. Trả lời tối đa 5 câu.';

  const userPrompt = JSON.stringify(
    {
      intent,
      message,
      products: contextProducts,
      recentHistory: history.slice(-4),
      requirements: intent === 'greeting'
        ? 'Trả lời tối đa 3 câu. Chỉ chào hỏi và mời xem phần sản phẩm bên dưới. Không lặp lại tên sản phẩm hoặc giá sản phẩm trong câu trả lời.'
        : 'Trả lời tối đa 5 câu. Nếu khách hàng muốn thêm sản phẩm vào giỏ hoặc kiểm tra đơn hàng, bạn phải gọi công cụ tương ứng (addToCart hoặc getOrderStatus).',
    },
    null,
    2
  );

  const geminiTools = [
    {
      functionDeclarations: [
        {
          name: 'addToCart',
          description: 'Thêm sản phẩm vào giỏ hàng của khách hàng.',
          parameters: {
            type: 'OBJECT',
            properties: {
              productId: {
                type: 'STRING',
                description: 'Mã sản phẩm (ID) cần thêm vào giỏ hàng. Lấy từ trường _id hoặc id của sản phẩm trong danh sách contextProducts.'
              },
              quantity: {
                type: 'NUMBER',
                description: 'Số lượng sản phẩm cần thêm. Mặc định là 1.'
              }
            },
            required: ['productId']
          }
        },
        {
          name: 'getOrderStatus',
          description: 'Tra cứu danh sách đơn hàng hoặc trạng thái đơn hàng của khách hàng.',
          parameters: {
            type: 'OBJECT',
            properties: {
              orderId: {
                type: 'STRING',
                description: 'Mã đơn hàng cần kiểm tra (tùy chọn).'
              }
            }
          }
        }
      ]
    }
  ];

  const openaiTools = [
    {
      type: 'function',
      function: {
        name: 'addToCart',
        description: 'Thêm sản phẩm vào giỏ hàng của khách hàng.',
        parameters: {
          type: 'object',
          properties: {
            productId: {
              type: 'string',
              description: 'Mã sản phẩm (ID) cần thêm vào giỏ hàng. Lấy từ trường _id hoặc id của sản phẩm trong danh sách contextProducts.'
            },
            quantity: {
              type: 'number',
              description: 'Số lượng sản phẩm cần thêm. Mặc định là 1.'
            }
          },
          required: ['productId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getOrderStatus',
        description: 'Tra cứu danh sách đơn hàng hoặc trạng thái đơn hàng của khách hàng.',
        parameters: {
          type: 'object',
          properties: {
            orderId: {
              type: 'string',
              description: 'Mã đơn hàng cần kiểm tra (tùy chọn).'
            }
          }
        }
      }
    }
  ];

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
            tools: geminiTools,
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
          tools: openaiTools,
          tool_choice: 'auto',
        }),
      });
    })();

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('maybeGenerateLlmReply API Error. Status:', response.status, 'Body:', errorText);
      return null;
    }

    const data = await response.json();

    if (isGemini) {
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCallPart = parts.find(p => p.functionCall);
      const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
      
      if (functionCallPart) {
        return {
          text: textParts || null,
          toolCall: {
            name: functionCallPart.functionCall.name,
            args: functionCallPart.functionCall.args
          }
        };
      }
      return {
        text: String(textParts || '').trim() || null,
        toolCall: null
      };
    } else {
      const message = data?.choices?.[0]?.message;
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        return {
          text: message.content || null,
          toolCall: {
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || '{}')
          }
        };
      }
      return {
        text: String(message?.content || '').trim() || null,
        toolCall: null
      };
    }
  } catch (error) {
    console.error('maybeGenerateLlmReply Error:', error);
    return null;
  }
}

async function generateEmbedding(text) {
  const llmEnabled = String(process.env.CHATBOT_LLM_ENABLED || '').toLowerCase() === 'true';
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || '').trim();
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || '').trim();

  if (!llmEnabled || !apiUrl || !apiKey || !text) {
    return null;
  }

  const isGemini = apiUrl.includes('generativelanguage.googleapis.com');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await (async () => {
      if (isGemini) {
        const baseUrl = apiUrl.split('/models/')[0];
        const requestUrl = `${baseUrl.replace(/\/$/, '')}/models/gemini-embedding-001:embedContent?key=${encodeURIComponent(apiKey)}`;
        return fetch(requestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            content: {
              parts: [{ text }]
            }
          })
        });
      }

      // OpenAI fallback
      const baseApiUrl = apiUrl.replace(/\/chat\/completions$/, '').replace(/\/$/, '');
      return fetch(`${baseApiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small'
        })
      });
    })();

    clearTimeout(timeout);
    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      console.error(`Embedding API error (Status: ${response.status}):`, errBody);
      return null;
    }

    const data = await response.json();
    if (isGemini) {
      return data?.embedding?.values || null;
    } else {
      return data?.data?.[0]?.embedding || null;
    }
  } catch (error) {
    clearTimeout(timeout);
    console.error('generateEmbedding Error:', error);
    return null;
  }
}

module.exports = {
  maybeParseQueryWithLlm,
  maybeGenerateLlmReply,
  generateEmbedding,
};
