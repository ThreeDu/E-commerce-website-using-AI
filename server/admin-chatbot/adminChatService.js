const {
  TOOL_DEFINITIONS,
  getDashboardStats,
  searchOrders,
  updateOrderStatus,
  searchProducts,
  updateProduct,
  searchUsers,
  getRecentLogs,
  createProduct,
  createDiscount,
} = require('./adminToolExecutor');

// ─── Config ────────────────────────────────────────────────────────────────────
const LLM_TIMEOUT_MS = 15000;
const MAX_TOOL_ITERATIONS = 3;

const WRITE_OPERATIONS = new Set(['updateOrderStatus', 'updateProduct', 'createProduct', 'createDiscount']);

const TOOL_FUNCTIONS = {
  getDashboardStats,
  searchOrders,
  updateOrderStatus,
  searchProducts,
  updateProduct,
  searchUsers,
  getRecentLogs,
  createProduct,
  createDiscount,
};

const SYSTEM_PROMPT = [
  'Bạn là trợ lý AI quản trị cho hệ thống e-commerce Tech Shop. Nhiệm vụ của bạn:',
  '- Hỗ trợ admin tra cứu thông tin (đơn hàng, sản phẩm, khách hàng, thống kê)',
  '- Thực hiện các thao tác quản trị khi được yêu cầu (cập nhật đơn hàng, chỉnh sửa sản phẩm)',
  '- Trả lời ngắn gọn, chính xác, chuyên nghiệp bằng tiếng Việt',
  '- Sử dụng tools/functions được cung cấp để truy vấn dữ liệu thực tế',
  '- Với số tiền, format theo VND (ví dụ: 25.000.000 VND)',
  '- Khi liệt kê nhiều items, sử dụng markdown table cho rõ ràng',
  '- Không bịa dữ liệu, chỉ trả lời dựa trên kết quả từ tools',
].join('\n');

// ─── LLM API call ──────────────────────────────────────────────────────────────

function getLlmConfig() {
  const apiUrl = String(process.env.CHATBOT_LLM_API_URL || '').trim();
  const apiKey = String(process.env.CHATBOT_LLM_API_KEY || '').trim();
  const model = String(process.env.CHATBOT_LLM_MODEL || 'gpt-4.1-mini').trim();
  const isGemini = apiUrl.includes('generativelanguage.googleapis.com');

  return { apiUrl, apiKey, model, isGemini };
}

/**
 * Build the messages array from conversation history + current message.
 * Converts the frontend history format into the format needed by the LLM APIs.
 */
function buildMessages(history, currentMessage) {
  const messages = [];

  if (Array.isArray(history)) {
    for (const entry of history) {
      const role = entry.role === 'assistant' ? 'assistant' : 'user';
      const content = String(entry.content || entry.message || '').trim();
      if (content) {
        messages.push({ role, content });
      }
    }
  }

  messages.push({ role: 'user', content: currentMessage });

  return messages;
}

/**
 * Call the LLM API with optional tool definitions.
 * Supports both OpenAI and Gemini APIs.
 * Returns: { textContent, toolCalls } where toolCalls is an array of { id, name, args }
 */
async function callLlm(messages, includeTools = true) {
  const { apiUrl, apiKey, model, isGemini } = getLlmConfig();

  if (!apiUrl || !apiKey) {
    throw new Error('LLM chưa được cấu hình. Vui lòng kiểm tra CHATBOT_LLM_API_URL và CHATBOT_LLM_API_KEY.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    let response;

    if (isGemini) {
      // ── Gemini API ──
      const baseEndpoint = apiUrl.includes(':generateContent')
        ? apiUrl
        : `${apiUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent`;
      const delimiter = baseEndpoint.includes('?') ? '&' : '?';
      const requestUrl = `${baseEndpoint}${delimiter}key=${encodeURIComponent(apiKey)}`;

      // Convert messages to Gemini contents format
      const contents = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const body = {
        systemInstruction: {
          role: 'system',
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents,
        generationConfig: { temperature: 0.3 },
      };

      if (includeTools) {
        body.tools = TOOL_DEFINITIONS.gemini;
      }

      response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
    } else {
      // ── OpenAI-compatible API ──
      const openaiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ];

      const body = {
        model,
        temperature: 0.3,
        messages: openaiMessages,
      };

      if (includeTools) {
        body.tools = TOOL_DEFINITIONS.openai;
        body.tool_choice = 'auto';
      }

      response = await fetch(`${apiUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
    }

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[AdminChatbot] LLM API error. Status:', response.status, 'Body:', errorText);
      throw new Error(`LLM API trả về lỗi (status ${response.status})`);
    }

    const data = await response.json();

    // Parse response based on provider
    if (isGemini) {
      return parseGeminiResponse(data);
    } else {
      return parseOpenAIResponse(data);
    }
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('LLM API timeout sau 15 giây. Vui lòng thử lại.');
    }
    throw error;
  }
}

function parseGeminiResponse(data) {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const textParts = parts.filter((p) => p.text).map((p) => p.text);
  const textContent = textParts.join('\n').trim() || null;

  const toolCalls = parts
    .filter((p) => p.functionCall)
    .map((p, index) => ({
      id: `gemini_call_${index}`,
      name: p.functionCall.name,
      args: p.functionCall.args || {},
    }));

  return { textContent, toolCalls };
}

function parseOpenAIResponse(data) {
  const message = data?.choices?.[0]?.message;
  const textContent = message?.content?.trim() || null;

  const toolCalls = (message?.tool_calls || []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    args: safeParseJson(tc.function.arguments),
  }));

  return { textContent, toolCalls };
}

function safeParseJson(str) {
  try {
    return JSON.parse(str || '{}');
  } catch {
    return {};
  }
}

// ─── Tool call feed-back helpers ───────────────────────────────────────────────

/**
 * After executing a tool, append the tool result into the messages array
 * so the LLM can use it in the next turn.
 */
function appendToolResultToMessages(messages, toolCall, result, isGemini) {
  if (isGemini) {
    // For Gemini: add model's function call + user's function response as text
    // (Gemini REST API function response format)
    messages.push({
      role: 'assistant',
      content: `Đã gọi hàm ${toolCall.name} với tham số: ${JSON.stringify(toolCall.args)}`,
    });
    messages.push({
      role: 'user',
      content: `Kết quả từ hàm ${toolCall.name}:\n${JSON.stringify(result, null, 2)}`,
    });
  } else {
    // For OpenAI: assistant message with tool_calls + tool role message
    // We simplify by using text-based tool result feeding
    messages.push({
      role: 'assistant',
      content: `Đã gọi hàm ${toolCall.name} với tham số: ${JSON.stringify(toolCall.args)}`,
    });
    messages.push({
      role: 'user',
      content: `Kết quả từ hàm ${toolCall.name}:\n${JSON.stringify(result, null, 2)}`,
    });
  }
}

/**
 * Generate a human-readable description for a write operation confirmation dialog.
 */
function generateConfirmationDescription(toolName, args) {
  if (toolName === 'updateOrderStatus') {
    const statusLabels = {
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    };
    const label = statusLabels[args.newStatus] || args.newStatus;
    let desc = `Cập nhật trạng thái đơn hàng ${args.orderId} thành "${label}"`;
    if (args.reason) desc += `. Lý do: ${args.reason}`;
    return desc;
  }

  if (toolName === 'updateProduct') {
    const parts = [`Cập nhật sản phẩm ${args.productId}`];
    if (args.price !== undefined) parts.push(`giá: ${Number(args.price).toLocaleString('vi-VN')} VND`);
    if (args.stock !== undefined) parts.push(`tồn kho: ${args.stock}`);
    if (args.discountPercent !== undefined) parts.push(`giảm giá: ${args.discountPercent}%`);
    return parts.join(', ');
  }

  if (toolName === 'createProduct') {
    let desc = `Tạo sản phẩm mới: "${args.name}"`;
    if (args.price) desc += `, giá: ${Number(args.price).toLocaleString('vi-VN')} VND`;
    if (args.category) desc += `, danh mục: ${args.category}`;
    if (args.stock) desc += `, tồn kho: ${args.stock}`;
    return desc;
  }

  if (toolName === 'createDiscount') {
    let desc = `Tạo mã giảm giá: "${args.code}"`;
    if (args.type === 'fixed') {
      desc += `, giảm ${Number(args.value).toLocaleString('vi-VN')} VND`;
    } else {
      desc += `, giảm ${args.value}%`;
    }
    if (args.minOrderValue) desc += `, đơn tối thiểu: ${Number(args.minOrderValue).toLocaleString('vi-VN')} VND`;
    return desc;
  }

  return `Thực hiện ${toolName} với tham số: ${JSON.stringify(args)}`;
}

// ─── Main service function ─────────────────────────────────────────────────────

/**
 * Process an admin chat message.
 *
 * @param {Object} params
 * @param {string} params.message - The admin's message
 * @param {Array}  params.history - Conversation history [{role, content}]
 * @param {string} params.sessionId - Session identifier
 * @param {string} params.adminUserId - Admin's MongoDB _id
 * @param {boolean} params.confirmed - Whether a pending write op has been confirmed
 * @param {Object} params.confirmationData - {toolName, args} for the confirmed write op
 * @returns {Object} { reply, requiresConfirmation?, confirmationData?, toolsUsed, sessionId }
 */
async function processAdminMessage({ message, history = [], sessionId, adminUserId, confirmed, confirmationData }) {
  const { isGemini } = getLlmConfig();
  const toolsUsed = [];

  try {
    // ── Handle confirmed write operation ──
    if (confirmed && confirmationData) {
      const { toolName, args } = confirmationData;

      if (!TOOL_FUNCTIONS[toolName]) {
        return {
          reply: `Lỗi: Không tìm thấy tool "${toolName}".`,
          toolsUsed: [],
          sessionId,
        };
      }

      // Inject adminUserId for write operations
      const execArgs = { ...args, adminUserId };
      const result = await TOOL_FUNCTIONS[toolName](execArgs);
      toolsUsed.push({ name: toolName, args });

      // Feed result back to LLM for a natural response
      const messages = buildMessages(history, message);
      appendToolResultToMessages(messages, { name: toolName, args }, result, isGemini);

      const { textContent } = await callLlm(messages, false);

      return {
        reply: textContent || `Đã thực hiện ${toolName} thành công.`,
        toolsUsed,
        sessionId,
      };
    }

    // ── Normal flow: send message to LLM with tools ──
    let messages = buildMessages(history, message);
    let reply = null;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const { textContent, toolCalls } = await callLlm(messages, true);

      // No tool calls: we have a final text response
      if (!toolCalls || toolCalls.length === 0) {
        reply = textContent;
        break;
      }

      // Process the first tool call
      const toolCall = toolCalls[0];
      const { name: toolName, args } = toolCall;

      if (!TOOL_FUNCTIONS[toolName]) {
        reply = `Lỗi: Không tìm thấy tool "${toolName}".`;
        break;
      }

      // ── Write operation: require confirmation ──
      if (WRITE_OPERATIONS.has(toolName)) {
        return {
          reply: null,
          requiresConfirmation: true,
          confirmationData: {
            toolName,
            args,
            description: generateConfirmationDescription(toolName, args),
          },
          sessionId,
        };
      }

      // ── Read operation: execute immediately ──
      const result = await TOOL_FUNCTIONS[toolName](args);
      toolsUsed.push({ name: toolName, args });

      appendToolResultToMessages(messages, toolCall, result, isGemini);

      // If this is the last iteration, get a final response without tools
      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        const finalResponse = await callLlm(messages, false);
        reply = finalResponse.textContent;
      }
      // Otherwise, loop back and let the LLM decide if it needs more tools
    }

    return {
      reply: reply || 'Xin lỗi, tôi không thể xử lý yêu cầu này. Vui lòng thử lại.',
      toolsUsed,
      sessionId,
    };
  } catch (error) {
    console.error('[AdminChatbot] processAdminMessage error:', error.message);
    return {
      reply: `Đã xảy ra lỗi khi xử lý yêu cầu: ${error.message}`,
      toolsUsed,
      sessionId,
    };
  }
}

module.exports = {
  processAdminMessage,
};
