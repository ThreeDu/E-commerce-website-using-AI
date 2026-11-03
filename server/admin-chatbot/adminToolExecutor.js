/**
 * adminToolExecutor.js — điểm vào của các tool admin chatbot.
 * Tool chia theo nhóm trong ./tools; file này chỉ gom export cho adminChatService.
 */
const readTools = require('./tools/readTools');
const writeTools = require('./tools/writeTools');
const batchTools = require('./tools/batchTools');
const { TOOL_SCHEMAS } = require('./tools/schemas');

module.exports = {
  ...readTools,
  ...writeTools,
  ...batchTools,
  TOOL_SCHEMAS,
};
