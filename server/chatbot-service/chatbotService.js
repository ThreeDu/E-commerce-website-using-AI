/**
 * chatbotService.js — LLM-first Agentic chatbot orchestrator
 *
 * Flow: User message → Build context → LLM with tools → Tool calling loop → Response
 */

const ChatSession = require('./models/ChatSession');
const { callLLMWithTools, callLLMStreaming } = require('./llmHelper');
const { TOOL_DEFINITIONS, executeTool } = require('./chatbotToolExecutor');

const MAX_TOOL_ITERATIONS = 5;
const MAX_HISTORY_MESSAGES = 16; // Keep last 16 messages for context

// ─── System Prompt ──────────────────────────────────────────────────────────
function buildSystemPrompt(context) {
  const { userId, userBehavior, page } = context;

  let prompt = `Bạn là trợ lý tư vấn bán hàng AI của cửa hàng điện tử. Nhiệm vụ của bạn là hỗ trợ khách hàng tìm kiếm sản phẩm, tư vấn lựa chọn, so sánh sản phẩm, theo dõi đơn hàng và giải đáp thắc mắc.

## Nguyên tắc hoạt động
- Luôn trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp
- Khi khách hỏi tư vấn sản phẩm hoặc tìm hiểu theo danh mục (ví dụ: Điện thoại, Laptop, Tablet,...), LUÔN sử dụng tool getCategories để xem danh mục hệ thống và gọi searchProducts với tham số category hoặc keyword tương ứng để liệt kê các sản phẩm thực tế thuộc danh mục đó.
- Phân tích chi tiết ưu nhược điểm, các phân khúc giá khác nhau (giá rẻ, tầm trung, cao cấp) và sản phẩm tiêu biểu trong danh mục khách quan tâm.
- KHÔNG BAO GIỜ bịa thông tin sản phẩm, giá cả, specs. Chỉ dựa trên dữ liệu từ tools
- Khi trả về danh sách sản phẩm, format thông tin rõ ràng và dễ đọc
- Khi so sánh sản phẩm, sử dụng bảng Markdown để hiển thị side-by-side
- Nếu khách chưa đăng nhập và yêu cầu thêm giỏ hàng hoặc tra cứu đơn hàng, hướng dẫn họ đăng nhập trước
- Gợi ý sản phẩm phù hợp dựa trên nhu cầu, ngân sách và sở thích của khách
- Cuối mỗi câu trả lời có liên quan đến sản phẩm, gợi ý 2-3 hành động tiếp theo mà khách có thể quan tâm

## Cách trả về sản phẩm cho giao diện
Khi muốn hiển thị sản phẩm dưới dạng card (có ảnh, giá, nút bấm), hãy đặt danh sách product IDs trong block đặc biệt ở CUỐI câu trả lời theo format:
\`\`\`products
["id1", "id2", "id3"]
\`\`\`
Chỉ dùng format này khi có sản phẩm thực sự để hiển thị. IDs phải lấy từ kết quả tool.

## Cách trả về quick replies
Để hiển thị nút gợi ý cho khách bấm nhanh, đặt ở CUỐI câu trả lời:
\`\`\`quickReplies
["Gợi ý 1", "Gợi ý 2", "Gợi ý 3"]
\`\`\`

## Các chính sách cửa hàng
- Giao hàng: Miễn phí nội thành, 1-3 ngày làm việc
- Đổi trả: Trong 7 ngày nếu sản phẩm lỗi hoặc không đúng mô tả
- Bảo hành: Theo chính sách nhà sản xuất
- Thanh toán: COD (thanh toán khi nhận hàng) hoặc chuyển khoản ngân hàng`;

  // Add user context
  if (userId) {
    prompt += `\n\n## Thông tin khách hàng\nKhách đã đăng nhập (userId: ${userId}). Có thể thêm giỏ hàng và tra cứu đơn hàng.`;
  } else {
    prompt += `\n\n## Thông tin khách hàng\nKhách CHƯA đăng nhập. Nếu họ muốn thêm giỏ hàng hoặc tra đơn hàng, nhắc họ đăng nhập trước.`;
  }

  // Add browsing behavior context
  if (userBehavior) {
    const behaviorParts = [];
    if (userBehavior.preferredCategories?.length) {
      behaviorParts.push(`Danh mục quan tâm: ${userBehavior.preferredCategories.join(', ')}`);
    }
    if (userBehavior.viewedProductIds?.length) {
      behaviorParts.push(`Đã xem ${userBehavior.viewedProductIds.length} sản phẩm`);
    }
    if (userBehavior.cartProductIds?.length) {
      behaviorParts.push(`Có ${userBehavior.cartProductIds.length} sản phẩm trong giỏ`);
    }
    if (behaviorParts.length > 0) {
      prompt += `\n\n## Hành vi duyệt web\n${behaviorParts.join('\n')}`;
    }
  }

  if (page) {
    prompt += `\n\nKhách đang xem trang: ${page}`;
  }

  return prompt;
}

// ─── Filter out raw LLM special tokens & tool call syntax ────────────────────
function cleanUpSpecialTokens(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // Remove <|tool_call>call: functionName{} or <|tool_call>...
  cleaned = cleaned.replace(/<\|tool_call\|?>[\s\S]*?(?:\{\}|(?=\n\n|\n[A-ZÀ-Ỹa-zà-ỹ]|$))/gi, '');
  cleaned = cleaned.replace(/<\|[a-z_0-9:-]+\|?>/gi, '');
  cleaned = cleaned.replace(/call:\s*[a-zA-Z0-9_]+\s*\{[^}]*\}/gi, '');
  cleaned = cleaned.replace(/```(?:tool_call|json_call|function_call)[\s\S]*?```/gi, '');

  // Remove leftover empty lines
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Extract structured data from LLM response ─────────────────────────────
function extractStructuredData(text) {
  let cleanText = cleanUpSpecialTokens(text);
  const productIds = [];
  const quickReplies = [];

  // Extract product IDs block (supports optional code blocks and optional colons)
  const productRegex = /(?:```)?products\s*:?\s*\n?(\[[\s\S]*?\])(?:\s*\n?```)?/i;
  const productMatch = cleanText.match(productRegex);
  if (productMatch) {
    try {
      const ids = JSON.parse(productMatch[1].trim());
      if (Array.isArray(ids)) productIds.push(...ids);
    } catch { /* ignore parse errors */ }
    cleanText = cleanText.replace(productRegex, '').trim();
  }

  // Extract quick replies block (supports optional code blocks and optional colons)
  const qrRegex = /(?:```)?quickReplies\s*:?\s*\n?(\[[\s\S]*?\])(?:\s*\n?```)?/i;
  const qrMatch = cleanText.match(qrRegex);
  if (qrMatch) {
    try {
      const replies = JSON.parse(qrMatch[1].trim());
      if (Array.isArray(replies)) quickReplies.push(...replies);
    } catch { /* ignore parse errors */ }
    cleanText = cleanText.replace(qrRegex, '').trim();
  }

  cleanText = cleanUpSpecialTokens(cleanText);

  return { cleanText, productIds, quickReplies };
}

// ─── Fetch product cards by IDs ─────────────────────────────────────────────
async function fetchProductCards(productIds) {
  if (!productIds.length) return [];

  const Product = require('../models/Product');
  const products = await Product.find({ _id: { $in: productIds } })
    .select('name price finalPrice discountPercent image averageRating totalPurchases stock')
    .lean();

  // Preserve order from LLM response
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  return productIds
    .map((id) => productMap.get(String(id)))
    .filter(Boolean)
    .map((p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      finalPrice: p.finalPrice,
      discountPercent: p.discountPercent || 0,
      image: p.image,
      averageRating: p.averageRating || 0,
      totalPurchases: p.totalPurchases || 0,
      stock: p.stock,
    }));
}

// ─── Main: Process a chat message ───────────────────────────────────────────
/**
 * @param {object} params
 * @param {string} params.message - User's message text
 * @param {string} params.sessionId - Session ID (UUID)
 * @param {string|null} params.userId - Authenticated user ID
 * @param {Array} params.history - Conversation history from frontend
 * @param {object} params.context - { page, userBehavior }
 * @returns {Promise<{reply, products[], quickReplies[], sessionId, cartUpdated}>}
 */
async function processMessage({ message, sessionId, userId, history, context }) {
  // 1. Load or create session from MongoDB
  let session = await ChatSession.findOne({ sessionId });

  if (!session) {
    session = new ChatSession({
      sessionId,
      userId: userId || null,
      messages: [],
      context: context || {},
    });
  } else if (userId && !session.userId) {
    // Associate anonymous session with newly logged-in user
    session.userId = userId;
  }

  // Update context
  if (context) {
    session.context = { ...session.context, ...context };
  }

  // 2. Build system prompt with user context
  const systemPrompt = buildSystemPrompt({
    userId,
    userBehavior: context?.userBehavior,
    page: context?.page,
  });

  // 3. Build conversation messages for LLM
  // Combine: persisted history + new user message
  const conversationMessages = session.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  // Add the new user message
  conversationMessages.push({ role: 'user', content: message });

  // Save user message to session
  session.messages.push({ role: 'user', content: message, timestamp: new Date() });

  // 4. LLM tool calling loop
  let llmMessages = [...conversationMessages];
  let finalContent = '';
  let cartUpdated = false;
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const result = await callLLMWithTools(systemPrompt, llmMessages, TOOL_DEFINITIONS);

    // No tool calls → we have the final response
    if (!result.toolCalls || result.toolCalls.length === 0) {
      finalContent = result.content;
      break;
    }

    // Has tool calls → execute them and feed results back
    // First, add the assistant's tool-calling message
    llmMessages.push({
      role: 'assistant',
      content: result.content || '',
      toolCalls: result.toolCalls,
    });

    // Execute each tool call
    for (const toolCall of result.toolCalls) {
      console.log(`[Chatbot] Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments).substring(0, 100)})`);

      const toolResult = await executeTool(toolCall.name, toolCall.arguments, userId);

      // Track cart updates
      if (toolCall.name === 'addToCart' && toolResult.success) {
        cartUpdated = true;
      }

      // Save tool execution to session
      session.messages.push({
        role: 'tool',
        content: `${toolCall.name}: ${JSON.stringify(toolResult).substring(0, 500)}`,
        toolName: toolCall.name,
        timestamp: new Date(),
      });

      // Feed tool result back to LLM
      llmMessages.push({
        role: 'tool',
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }

    // If we're on the last iteration and still getting tool calls, force a text response
    if (iterations === MAX_TOOL_ITERATIONS) {
      const fallbackResult = await callLLMWithTools(systemPrompt, llmMessages, []);
      finalContent = fallbackResult.content || 'Xin lỗi, tôi đang gặp sự cố xử lý. Vui lòng thử lại.';
    }
  }

  // 5. Extract structured data from LLM response
  const { cleanText, productIds, quickReplies } = extractStructuredData(finalContent);

  // 6. Fetch product cards if LLM referenced any
  const products = await fetchProductCards(productIds);

  // 7. Save assistant reply to session
  session.messages.push({ role: 'assistant', content: cleanText || '', timestamp: new Date() });

  // Trim session history to prevent unbounded growth
  if (session.messages.length > MAX_HISTORY_MESSAGES * 3) {
    session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES * 2);
  }

  await session.save();

  // 8. Return response
  return {
    reply: cleanText,
    products,
    quickReplies,
    sessionId,
    cartUpdated,
  };
}

// ─── Streaming: Process message with SSE ────────────────────────────────────
/**
 * Same as processMessage but streams the final LLM response.
 * Tool calling loop runs non-streamed. Only final text is streamed.
 *
 * @param {object} params - Same as processMessage
 * @param {Function} params.onChunk - Called with each text chunk
 * @param {Function} params.onProducts - Called with products & quickReplies metadata
 * @returns {Promise<{sessionId, cartUpdated}>}
 */
async function processMessageStream({ message, sessionId, userId, context, onChunk, onProducts }) {
  let session = await ChatSession.findOne({ sessionId });

  if (!session) {
    session = new ChatSession({
      sessionId,
      userId: userId || null,
      messages: [],
      context: context || {},
    });
  } else if (userId && !session.userId) {
    session.userId = userId;
  }

  if (context) {
    session.context = { ...session.context, ...context };
  }

  const systemPrompt = buildSystemPrompt({
    userId,
    userBehavior: context?.userBehavior,
    page: context?.page,
  });

  const conversationMessages = session.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content }));

  conversationMessages.push({ role: 'user', content: message });
  session.messages.push({ role: 'user', content: message, timestamp: new Date() });

  // Tool calling loop (non-streamed)
  let llmMessages = [...conversationMessages];
  let cartUpdated = false;
  let iterations = 0;
  let needsStream = true;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const result = await callLLMWithTools(systemPrompt, llmMessages, TOOL_DEFINITIONS);

    if (!result.toolCalls || result.toolCalls.length === 0) {
      // No tool calls — stream this final response instead
      needsStream = true;
      break;
    }

    llmMessages.push({
      role: 'assistant',
      content: result.content || '',
      toolCalls: result.toolCalls,
    });

    for (const toolCall of result.toolCalls) {
      console.log(`[Chatbot-Stream] Tool: ${toolCall.name}`);
      const toolResult = await executeTool(toolCall.name, toolCall.arguments, userId);

      if (toolCall.name === 'addToCart' && toolResult.success) cartUpdated = true;

      session.messages.push({
        role: 'tool',
        content: `${toolCall.name}: ${JSON.stringify(toolResult).substring(0, 500)}`,
        toolName: toolCall.name,
        timestamp: new Date(),
      });

      llmMessages.push({
        role: 'tool',
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }

    if (iterations === MAX_TOOL_ITERATIONS) {
      needsStream = true;
      break;
    }
  }

  // Stream the final response
  let fullText = '';
  if (needsStream) {
    try {
      fullText = await callLLMStreaming(systemPrompt, llmMessages, onChunk);
    } catch (streamError) {
      // Fallback to non-streaming if streaming fails
      console.warn('[Chatbot-Stream] Streaming failed, falling back:', streamError.message);
      const fallback = await callLLMWithTools(systemPrompt, llmMessages, []);
      fullText = fallback.content || 'Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại.';
      onChunk(fullText);
    }
  }

  // Extract structured data and send metadata
  const { cleanText, productIds, quickReplies } = extractStructuredData(fullText);
  const products = await fetchProductCards(productIds);

  if (onProducts && (products.length > 0 || quickReplies.length > 0)) {
    onProducts({ products, quickReplies });
  }

  // Save to session
  session.messages.push({ role: 'assistant', content: cleanText || '', timestamp: new Date() });
  if (session.messages.length > MAX_HISTORY_MESSAGES * 3) {
    session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES * 2);
  }
  await session.save();

  return { sessionId, cartUpdated };
}

module.exports = { processMessage, processMessageStream };
