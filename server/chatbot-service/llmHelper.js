/**
 * llmHelper.js — LLM API abstraction layer
 *
 * Features:
 *  - Multi-provider fallback chain (local → gemini → openai)
 *  - Streaming support (SSE)
 *  - Dual format: Gemini & OpenAI-compatible
 *
 * NOTE: Env vars are read at call time (not import time) because
 * dotenv.config() runs after module imports in index.js.
 */

// ─── Provider Config ────────────────────────────────────────────────────────

/**
 * Parse multi-provider config from env.
 * Format: CHATBOT_LLM_PROVIDERS=local,gemini (comma-separated, ordered by priority)
 *
 * Each provider needs:
 *   CHATBOT_LLM_{PROVIDER}_URL, CHATBOT_LLM_{PROVIDER}_KEY, CHATBOT_LLM_{PROVIDER}_MODEL
 *
 * Falls back to legacy single-provider config (CHATBOT_LLM_API_URL etc.)
 */
function getProviders() {
  const providerNames = (process.env.CHATBOT_LLM_PROVIDERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const timeout = Number(process.env.CHATBOT_LLM_TIMEOUT_MS) || 60000;

  if (providerNames.length > 0) {
    return providerNames.map((name) => {
      const upper = name.toUpperCase();
      return {
        name,
        apiUrl: process.env[`CHATBOT_LLM_${upper}_URL`] || '',
        apiKey: process.env[`CHATBOT_LLM_${upper}_KEY`] || '',
        model: process.env[`CHATBOT_LLM_${upper}_MODEL`] || 'gpt-4.1-mini',
        timeout,
      };
    }).filter((p) => p.apiUrl && p.apiKey);
  }

  // Legacy single-provider fallback
  const apiUrl = process.env.CHATBOT_LLM_API_URL || '';
  const apiKey = process.env.CHATBOT_LLM_API_KEY || '';
  if (!apiUrl || !apiKey) return [];

  return [{
    name: 'default',
    apiUrl,
    apiKey,
    model: process.env.CHATBOT_LLM_MODEL || 'gpt-4.1-mini',
    timeout,
  }];
}

function isProviderGemini(provider) {
  return provider.apiUrl.includes('generativelanguage.googleapis.com');
}

// ─── URL builders ───────────────────────────────────────────────────────────

function buildGeminiUrl(provider, streaming = false) {
  const baseUrl = provider.apiUrl.replace(/\/+$/, '');
  const action = streaming ? 'streamGenerateContent' : 'generateContent';
  const streamParam = streaming ? '&alt=sse' : '';
  if (baseUrl.includes('/models/')) {
    const actionUrl = baseUrl.replace(/:(generateContent|streamGenerateContent)/, `:${action}`);
    return `${actionUrl}?key=${provider.apiKey}${streamParam}`;
  }
  return `${baseUrl}/v1beta/models/${provider.model}:${action}?key=${provider.apiKey}${streamParam}`;
}

function buildOpenAIUrl(provider) {
  const baseUrl = provider.apiUrl.replace(/\/+$/, '');
  if (baseUrl.match(/\/(chat|completions)/)) return baseUrl;
  return `${baseUrl}/v1/chat/completions`;
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
    if (msg.role === 'system') continue;
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

// ─── Build request bodies ───────────────────────────────────────────────────

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

function buildOpenAIBody(provider, systemPrompt, messages, tools, streaming = false) {
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
    model: provider.model,
    messages: oaiMessages,
    temperature: 0.7,
    max_tokens: 4096,
  };

  if (streaming) body.stream = true;

  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  return body;
}

// ─── Parse responses ────────────────────────────────────────────────────────

function parseGeminiResponse(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate?.content?.parts) return { content: '', toolCalls: [] };

  let textContent = '';
  const toolCalls = [];

  for (const part of candidate.content.parts) {
    if (part.text) textContent += part.text;
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

function parseOpenAIResponse(data) {
  const choice = data?.choices?.[0];
  if (!choice?.message) return { content: '', toolCalls: [] };

  const msg = choice.message;
  const toolCalls = (msg.tool_calls || []).map((tc) => {
    let args = {};
    try {
      args = typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments || {};
    } catch {
      args = {};
    }
    return {
      id: tc.id || `call_${tc.function.name}_${Date.now()}`,
      name: tc.function.name,
      arguments: args,
    };
  });

  let content = msg.content || '';

  // If content is empty but model returned reasoning_content (common in reasoning models like Gemma 4/DeepSeek R1)
  if (!content && msg.reasoning_content) {
    content = msg.reasoning_content;
  }

  // Fallback: If tool_calls array is empty but content contains inline tool call text
  if (toolCalls.length === 0 && content) {
    const inlineToolMatch = content.match(/(?:call:|<\|tool_call\|?>)\s*([a-zA-Z0-9_]+)\s*(\{[\s\S]*?\})/i);
    if (inlineToolMatch) {
      try {
        const name = inlineToolMatch[1];
        const args = JSON.parse(inlineToolMatch[2] || '{}');
        toolCalls.push({
          id: `inline_call_${name}_${Date.now()}`,
          name,
          arguments: args,
        });
        // Clear content if it was only a tool call string
        content = content.replace(/(?:call:|<\|tool_call\|?>)\s*[a-zA-Z0-9_]+\s*\{[\s\S]*?\}/gi, '').trim();
      } catch { /* skip */ }
    }
  }

  return { content, toolCalls };
}

// ─── Single provider call ───────────────────────────────────────────────────

async function callProvider(provider, systemPrompt, messages, tools) {
  const useGemini = isProviderGemini(provider);
  const url = useGemini ? buildGeminiUrl(provider) : buildOpenAIUrl(provider);
  const body = useGemini
    ? buildGeminiBody(systemPrompt, messages, tools)
    : buildOpenAIBody(provider, systemPrompt, messages, tools);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (!useGemini) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`[${provider.name}] Status ${res.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await res.json();
    return useGemini ? parseGeminiResponse(data) : parseOpenAIResponse(data);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Main: Call LLM with fallback chain ─────────────────────────────────────
/**
 * @param {string} systemPrompt
 * @param {Array} messages
 * @param {Array} tools
 * @returns {Promise<{content: string, toolCalls: Array}>}
 */
async function callLLMWithTools(systemPrompt, messages, tools = []) {
  const providers = getProviders();

  if (providers.length === 0) {
    throw new Error('LLM chưa được cấu hình. Kiểm tra CHATBOT_LLM_PROVIDERS hoặc CHATBOT_LLM_API_URL trong .env');
  }

  const errors = [];

  for (const provider of providers) {
    try {
      console.log(`[LLM] Trying provider: ${provider.name} (${provider.model})`);
      const result = await callProvider(provider, systemPrompt, messages, tools);
      return result;
    } catch (error) {
      const reason = error.name === 'AbortError' ? `timeout (${provider.timeout}ms)` : error.message;
      console.warn(`[LLM] Provider ${provider.name} failed: ${reason}`);
      errors.push({ provider: provider.name, error: reason });
    }
  }

  throw new Error(`Tất cả LLM providers đều thất bại:\n${errors.map((e) => `  - ${e.provider}: ${e.error}`).join('\n')}`);
}

// ─── Streaming: Call LLM and stream response ────────────────────────────────

/**
 * Stream LLM response token by token.
 * Only streams the final text response (no tool calls in stream mode).
 *
 * @param {string} systemPrompt
 * @param {Array} messages
 * @param {Function} onChunk - Called with each text chunk: onChunk(text)
 * @returns {Promise<string>} - Full accumulated text
 */
async function callLLMStreaming(systemPrompt, messages, onChunk) {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error('LLM chưa được cấu hình.');
  }

  const errors = [];

  for (const provider of providers) {
    try {
      console.log(`[LLM-Stream] Trying provider: ${provider.name}`);
      const result = await streamFromProvider(provider, systemPrompt, messages, onChunk);
      return result;
    } catch (error) {
      const reason = error.name === 'AbortError' ? `timeout` : error.message;
      console.warn(`[LLM-Stream] Provider ${provider.name} failed: ${reason}`);
      errors.push({ provider: provider.name, error: reason });
    }
  }

  throw new Error(`Tất cả LLM providers đều thất bại (streaming):\n${errors.map((e) => `  - ${e.provider}: ${e.error}`).join('\n')}`);
}

async function streamFromProvider(provider, systemPrompt, messages, onChunk) {
  const useGemini = isProviderGemini(provider);

  let url, body;
  if (useGemini) {
    url = buildGeminiUrl(provider, true);
    body = buildGeminiBody(systemPrompt, messages, []);
  } else {
    url = buildOpenAIUrl(provider);
    body = buildOpenAIBody(provider, systemPrompt, messages, [], true);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (!useGemini) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`[${provider.name}] Status ${res.status}: ${errorText.substring(0, 200)}`);
    }

    // Read SSE stream
    let fullText = '';
    const reader = res.body;
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of reader) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          let text = '';

          if (useGemini) {
            // Gemini streaming format
            const parts = parsed?.candidates?.[0]?.content?.parts || [];
            text = parts.map((p) => p.text || '').join('');
          } else {
            // OpenAI streaming format (supports standard delta.content and reasoning model delta.reasoning_content)
            const delta = parsed?.choices?.[0]?.delta;
            text = delta?.content || delta?.reasoning_content || '';
          }

          if (text) {
            fullText += text;
            onChunk(text);
          }
        } catch { /* skip unparseable lines */ }
      }
    }

    return fullText;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Vision: Call LLM with image ────────────────────────────────────────────

/**
 * Call LLM with an image for visual recognition.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {string} imageBase64 - Base64 encoded image data
 * @param {string} mimeType - e.g. 'image/jpeg', 'image/png'
 * @returns {Promise<{content: string}>}
 */
async function callLLMWithImage(systemPrompt, userMessage, imageBase64, mimeType = 'image/jpeg') {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error('LLM chưa được cấu hình.');
  }

  const errors = [];

  for (const provider of providers) {
    try {
      const useGemini = isProviderGemini(provider);
      const url = useGemini ? buildGeminiUrl(provider) : buildOpenAIUrl(provider);

      let body;
      if (useGemini) {
        body = {
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{
            role: 'user',
            parts: [
              { text: userMessage },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        };
      } else {
        body = {
          model: provider.model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: userMessage },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              ],
            },
          ],
          temperature: 0.7,
          max_tokens: 2048,
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), provider.timeout);

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (!useGemini) headers['Authorization'] = `Bearer ${provider.apiKey}`;

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          throw new Error(`[${provider.name}] Status ${res.status}: ${errorText.substring(0, 200)}`);
        }

        const data = await res.json();
        const result = useGemini ? parseGeminiResponse(data) : parseOpenAIResponse(data);
        return { content: result.content };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      errors.push({ provider: provider.name, error: error.message });
    }
  }

  throw new Error(`Vision: tất cả providers đều thất bại`);
}

module.exports = { callLLMWithTools, callLLMStreaming, callLLMWithImage };
