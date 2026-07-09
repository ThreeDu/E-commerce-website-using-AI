/**
 * textUtils.js — Text utilities for chatbot service
 */

/**
 * Normalize Vietnamese text: remove diacritics, lowercase.
 */
function normalizeVietnamese(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Safely extract JSON from LLM response text.
 * Handles cases where JSON is wrapped in markdown code blocks.
 */
function extractJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Format a number as Vietnamese currency (VND).
 */
function formatPrice(num) {
  if (typeof num !== 'number' || !Number.isFinite(num)) return '0₫';
  return num.toLocaleString('vi-VN') + '₫';
}

module.exports = {
  normalizeVietnamese,
  extractJSON,
  formatPrice,
};
