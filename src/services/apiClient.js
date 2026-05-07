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

/**
 * @param {string}  url
 * @param {object}  [options]
 * @param {string}  [options.method]   HTTP method (default GET)
 * @param {object}  [options.body]     Will be JSON-stringified automatically
 * @param {string}  [options.token]    Bearer token
 * @param {object}  [options.headers]  Extra headers
 * @returns {Promise<any>}            Parsed JSON body
 */
export async function apiClient(url, options = {}) {
  const { method = "GET", body, token, headers: extraHeaders } = options;

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
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data?.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
