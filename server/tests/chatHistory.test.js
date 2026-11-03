const test = require("node:test");
const assert = require("node:assert");
const ChatSession = require("../models/ChatSession");
const { getSessionHistory } = require("../chatbot-service/chatbotService");

function stubSession(session) {
  ChatSession.findOne = () => ({ lean: async () => session });
}

const OWNER = "6ae9ead4cfb27b4f014deb5d";
const messages = [
  { role: "user", content: "Tìm laptop" },
  { role: "tool", content: "searchProducts: ...", toolName: "searchProducts" },
  { role: "assistant", content: "Gợi ý cho bạn" },
];

test("lịch sử phiên gắn tài khoản chỉ trả cho đúng chủ sở hữu", async () => {
  stubSession({ sessionId: "s1", userId: OWNER, messages });

  const own = await getSessionHistory("s1", OWNER);
  assert.deepStrictEqual(own.map((m) => [m.role, m.text]), [["user", "Tìm laptop"], ["assistant", "Gợi ý cho bạn"]]);
  assert.strictEqual(await getSessionHistory("s1", "6ae9ead4cfb27b4f014deb5e"), null);
  assert.strictEqual(await getSessionHistory("s1", null), null);
});

test("phiên ẩn danh đọc được bằng sessionId; phiên không tồn tại trả null", async () => {
  stubSession({ sessionId: "s2", userId: null, messages });
  assert.strictEqual((await getSessionHistory("s2", null)).length, 2);

  stubSession(null);
  assert.strictEqual(await getSessionHistory("missing", OWNER), null);
  assert.strictEqual(await getSessionHistory(undefined, OWNER), null);
});
