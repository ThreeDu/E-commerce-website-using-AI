/**
 * User-facing category API service.
 */
import { apiClient } from "./apiClient";

export async function fetchCategories() {
  return apiClient("/api/categories");
}
