/**
 * llmHelper.js — LLM API abstraction layer
 *
 * Supports dual-provider: Google Gemini & OpenAI-compatible APIs.
 * Auto-detects provider based on API URL.
 *
 * NOTE: Env vars are read at call time (not import time) because
 * dotenv.config() runs after module imports in index.js.
 */

const getConfig = () => ({
  apiUrl: process.env.CHATBOT_LLM_API_URL || '',
  apiKey: process.env.CHATBOT_LLM_API_KEY || '',
  model: process.env.CHATBOT_LLM_MODEL || 'gpt-4.1-mini',
  timeout: Number(process.env.CHATBOT_LLM_TIMEOUT_MS) || 60000,
});

function isGemini() {
  return getConfig().apiUrl.includes('generativelanguage.googleapis.com');
}

// ─── Convert tool definitions to Gemini format ──────────────────────────────
function toGeminiTools(tools) {
  return [
    {
      function_declarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
}

// ─── Convert messages to Gemini format ──────────────────────────────────────
function toGeminiContents(messages) {
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'system') continue; // system handled separately
    if (msg.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [
          {
            functionResponse: {
              name: msg.toolName || 'unknown',
              response: { result: msg.content },
            },
          },
        ],
      });
    } else if (msg.role === 'assistant' && msg.toolCalls) {
      contents.push({
        role: 'model',
        parts: msg.toolCalls.map((tc) => ({
          functionCall: {
            name: tc.name,
            args: tc.arguments,
          },
        })),
      });
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || '' }],
      });
    }
  }
  return contents;
}

// ─── Build Gemini request body ──────────────────────────────────────────────
function buildGeminiBody(systemPrompt, messages, tools) {
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };
  if (tools && tools.length > 0) {
    body.tools = toGeminiTools(tools);
  }
  return body;
}

// ─── Build OpenAI request body ──────────────────────────────────────────────
function buildOpenAIBody(systemPrompt, messages, tools) {
  const oaiMessages = [{ role: 'system', content: systemPrompt }];

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    if (msg.role === 'tool') {
      oaiMessages.push({
        role: 'tool',
        tool_call_id: msg.toolCallId || `call_${msg.toolName}`,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
    } else if (msg.role === 'assistant' && msg.toolCalls) {
      oaiMessages.push({
        role: 'assistant',
        content: null,
        tool_calls: msg.toolCalls.map((tc, idx) => ({
          id: tc.id || `call_${tc.name}_${idx}`,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
          },
        })),
      });
    } else {
      oaiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const body = {
    model: getConfig().model,
    messages: oaiMessages,
    temperature: 0.7,
    max_tokens: 4096,
  };

  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  return body;
}

// ─── Parse Gemini response ──────────────────────────────────────────────────
function parseGeminiResponse(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate?.content?.parts) return { content: '', toolCalls: [] };

  let textContent = '';
  const toolCalls = [];

  for (const part of candidate.content.parts) {
    if (part.text) {
      textContent += part.text;
    }
    if (part.functionCall) {
      toolCalls.push({
        id: `call_${part.functionCall.name}_${Date.now()}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  return { content: textContent, toolCalls };
}

// ─── Parse OpenAI response ──────────────────────────────────────────────────
function parseOpenAIResponse(data) {
  const choice = data?.choices?.[0];
  if (!choice?.message) return { content: '', toolCalls: [] };

  const msg = choice.message;
  const toolCalls = (msg.tool_calls || []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: typeof tc.function.arguments === 'string'
      ? JSON.parse(tc.function.arguments)
      : tc.function.arguments,
  }));

  return { content: msg.content || '', toolCalls };
}

// ─── Main function: Call LLM with tools ─────────────────────────────────────
/**
 * @param {string} systemPrompt - System instructions
 * @param {Array} messages - Conversation history [{role, content, toolCalls?, toolName?, toolCallId?}]
 * @param {Array} tools - Tool definitions [{name, description, parameters}]
 * @returns {Promise<{content: string, toolCalls: Array}>}
 */
async function callLLMWithTools(systemPrompt, messages, tools = []) {
  const config = getConfig();

  if (!config.apiUrl || !config.apiKey) {
    throw new Error('LLM chưa được cấu hình. Kiểm tra CHATBOT_LLM_API_URL và CHATBOT_LLM_API_KEY trong .env');
  }

  const useGemini = isGemini();
  let url, body;

  if (useGemini) {
    // Build Gemini API URL
    const baseUrl = config.apiUrl.replace(/\/+$/, '');
    if (baseUrl.includes('/models/')) {
      url = `${baseUrl}?key=${config.apiKey}`;
    } else {
      url = `${baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    }
    body = buildGeminiBody(systemPrompt, messages, tools);
  } else {
    // OpenAI-compatible (includes LM Studio, Ollama, etc.)
    const baseUrl = config.apiUrl.replace(/\/+$/, '');

    // Auto-detect endpoint path:
    // - If URL already has /chat or /completions path → use as-is
    // - Otherwise → /v1/chat/completions
    if (baseUrl.match(/\/(chat|completions)/)) {
      url = baseUrl;
    } else {
      url = `${baseUrl}/v1/chat/completions`;
    }

    body = buildOpenAIBody(systemPrompt, messages, tools);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (!useGemini) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`LLM API trả về lỗi (status ${res.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await res.json();
    return useGemini ? parseGeminiResponse(data) : parseOpenAIResponse(data);
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { callLLMWithTools };
