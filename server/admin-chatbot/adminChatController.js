const { verifyAdminRequest } = require('../routes/helpers/authHelpers');
const { processAdminMessage, processAdminMessageStream } = require('./adminChatService');
const AdminChatSession = require('../models/AdminChatSession');

/**
 * POST /api/admin/chatbot/message/stream
 */
async function chatStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) {
      sendEvent('error', { message: 'Unauthorized' });
      res.end();
      return;
    }

    const { message, history, sessionId, confirmed, confirmationData } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      sendEvent('error', { message: 'Tin nhắn không được để trống.' });
      res.end();
      return;
    }

    const safeSessionId = sessionId || `admin_${admin._id}_${Date.now()}`;

    const result = await processAdminMessageStream({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      sessionId: safeSessionId,
      adminUserId: admin._id,
      confirmed: !!confirmed,
      confirmationData: confirmationData || null,
      onChunk: (text) => sendEvent('token', { text }),
      onToolsUsed: (toolsUsed) => sendEvent('tools', { toolsUsed }),
    });

    let session = await AdminChatSession.findOne({ sessionId: safeSessionId, adminId: admin._id });
    if (!session) {
      const title = message.trim().length > 40 ? message.trim().substring(0, 40) + '...' : message.trim();
      session = new AdminChatSession({
        adminId: admin._id,
        sessionId: safeSessionId,
        title,
        messages: [],
      });
    }

    if (confirmed) {
      session.messages = session.messages.filter((m) => m.role !== 'confirmation');
    } else {
      session.messages.push({ role: 'user', content: message.trim(), timestamp: new Date() });
    }

    if (Array.isArray(result.toolsUsed) && result.toolsUsed.length > 0) {
      for (const tool of result.toolsUsed) {
        session.messages.push({
          role: 'tool',
          content: `Đã thực hiện: ${tool.name}`,
          toolName: tool.name,
          timestamp: new Date(),
        });
      }
    }

    if (result.requiresConfirmation && result.confirmationData) {
      session.messages.push({
        role: 'confirmation',
        content: result.confirmationData.description || 'Xác nhận thao tác?',
        confirmationData: result.confirmationData,
        timestamp: new Date(),
      });
      sendEvent('confirmation', result.confirmationData);
    }

    if (result.reply) {
      session.messages.push({ role: 'assistant', content: result.reply, timestamp: new Date() });
    }

    await session.save();
    sendEvent('done', { sessionId: safeSessionId, ...result });
  } catch (error) {
    console.error('[AdminChatbot-Stream] Error:', error.message);
    sendEvent('error', { message: error.message });
  } finally {
    res.end();
  }
}

/**
 * POST /api/admin/chatbot/message
 */
async function chat(req, res) {
  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    const { message, history, sessionId, confirmed, confirmationData } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tin nhắn không được để trống.',
      });
    }

    const safeSessionId = sessionId || `admin_${admin._id}_${Date.now()}`;

    const result = await processAdminMessage({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      sessionId: safeSessionId,
      adminUserId: admin._id,
      confirmed: !!confirmed,
      confirmationData: confirmationData || null,
    });

    // ─── Save / Update Chat Session in DB ───
    let session = await AdminChatSession.findOne({ sessionId: safeSessionId, adminId: admin._id });
    const isNew = !session;

    if (isNew) {
      const title = message.trim().length > 40 ? message.trim().substring(0, 40) + '...' : message.trim();
      session = new AdminChatSession({
        adminId: admin._id,
        sessionId: safeSessionId,
        title,
        messages: [],
      });
    }

    if (confirmed) {
      // Remove any pending confirmation messages to resolve it
      session.messages = session.messages.filter((m) => m.role !== 'confirmation');
    } else {
      // Add user message
      session.messages.push({
        role: 'user',
        content: message.trim(),
        timestamp: new Date(),
      });
    }

    // Add tool executions
    if (Array.isArray(result.toolsUsed) && result.toolsUsed.length > 0) {
      for (const tool of result.toolsUsed) {
        session.messages.push({
          role: 'tool',
          content: `Đã thực hiện: ${tool.name}`,
          toolName: tool.name,
          timestamp: new Date(),
        });
      }
    }

    // Add confirmation prompt
    if (result.requiresConfirmation && result.confirmationData) {
      session.messages.push({
        role: 'confirmation',
        content: result.confirmationData.description || 'Xác nhận thao tác?',
        confirmationData: result.confirmationData,
        timestamp: new Date(),
      });
    }

    // Add assistant reply
    if (result.reply) {
      session.messages.push({
        role: 'assistant',
        content: result.reply,
        timestamp: new Date(),
      });
    }

    await session.save();

    return res.json({
      success: true,
      ...result,
      sessionId: safeSessionId,
    });
  } catch (error) {
    console.error('[AdminChatbot] Controller error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
    });
  }
}

/**
 * GET /api/admin/chatbot/sessions
 */
async function getSessions(req, res) {
  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    const sessions = await AdminChatSession.find({ adminId: admin._id })
      .sort({ updatedAt: -1 })
      .select('sessionId title updatedAt')
      .lean();

    return res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error('[AdminChatbot] getSessions error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách phiên chat.',
    });
  }
}

/**
 * GET /api/admin/chatbot/sessions/:sessionId
 */
async function getSessionDetail(req, res) {
  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    const { sessionId } = req.params;
    const session = await AdminChatSession.findOne({ sessionId, adminId: admin._id }).lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phiên chat.',
      });
    }

    // Filter out active confirmation buttons from history to keep it clean
    const cleanMessages = (session.messages || []).filter((m) => m.role !== 'confirmation');

    return res.json({
      success: true,
      sessionId: session.sessionId,
      title: session.title,
      messages: cleanMessages,
    });
  } catch (error) {
    console.error('[AdminChatbot] getSessionDetail error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải chi tiết phiên chat.',
    });
  }
}

/**
 * DELETE /api/admin/chatbot/sessions/:sessionId
 */
async function deleteSession(req, res) {
  try {
    const admin = await verifyAdminRequest(req, res);
    if (!admin) return;

    const { sessionId } = req.params;
    const session = await AdminChatSession.findOneAndDelete({ sessionId, adminId: admin._id });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phiên chat để xóa.',
      });
    }

    return res.json({
      success: true,
      message: 'Đã xóa phiên chat thành công.',
    });
  } catch (error) {
    console.error('[AdminChatbot] deleteSession error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể xóa phiên chat.',
    });
  }
}

module.exports = {
  chat,
  chatStream,
  getSessions,
  getSessionDetail,
  deleteSession,
};
