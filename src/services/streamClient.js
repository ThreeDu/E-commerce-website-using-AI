/**
 * SSE helpers for the chatbot streaming endpoints. These stay on raw fetch
 * because apiClient parses the whole body as JSON.
 */

/** POSTs JSON and returns the raw Response so the caller can read its stream. */
export function postStream(url, body, token) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** Reads "event: x" / "data: {json}" pairs and calls onEvent(event, payload) for each. */
export async function readSseEvents(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ") && currentEvent) {
        try {
          onEvent(currentEvent, JSON.parse(line.slice(6)));
        } catch {
          // skip unparseable
        }
        currentEvent = null;
      }
    }
  }
}
