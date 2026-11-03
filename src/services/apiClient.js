/**
 * Lightweight fetch wrapper used by all service modules.
 *
 * - Automatically sets JSON content-type for requests with a body.
 * - Automatically attaches the Authorization header when a token is provided.
 * - Throws an Error with the server's message when the response is not ok.
 */

const BASE_HEADERS = {
  "Content-Type": "application/json",
};

// Empty body -> {}, non-JSON body (e.g. an HTML error page) -> { message }.
async function parseResponseSafely(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    return {
      message: rawText.startsWith("<!DOCTYPE")
        ? "Server trả về HTML thay vì JSON. Vui lòng kiểm tra server API hoặc payload gửi lên."
        : rawText,
    };
  }
}

/**
 * @param {string}  url
 * @param {object}  [options]
 * @param {string}  [options.method]        HTTP method (default GET)
 * @param {object}  [options.body]          Will be JSON-stringified automatically
 * @param {string}  [options.token]         Bearer token
 * @param {object}  [options.headers]       Extra headers
 * @param {string}  [options.errorMessage]  Fallback message when the server sends none
 * @returns {Promise<any>}                 Parsed JSON body
 */
export async function apiClient(url, options = {}) {
  const { method = "GET", body, token, headers: extraHeaders, errorMessage } = options;

  const headers = { ...BASE_HEADERS, ...extraHeaders };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fetchOptions = {
    method,
    headers,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await parseResponseSafely(response);

  if (!response.ok) {
    const error = new Error(
      data?.message || errorMessage || `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/** Builds "?a=1&b=2" from params, skipping undefined/null/"" values. */
export function buildQueryString(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}
