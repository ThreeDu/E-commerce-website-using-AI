/**
 * reportGenerator.js — Generates Excel reports for Admin chatbot.
 *
 * File được lưu trong collection Firestore "reports" (Vercel không cho ghi đĩa) và tải qua
 * GET /api/reports/:id. ID ngẫu nhiên không đoán được, hết hạn sau 1 ngày (field expireAt,
 * bật TTL policy trong Firebase Console để tự xoá).
 *
 * shortcut: lưu file base64 trong một document nên giới hạn ~700KB/file (document tối đa 1 MiB);
 * báo cáo lớn hơn cần Firebase Storage.
 */

const XLSX = require('xlsx');
const { getDb, newId, isId } = require('../db/firestore');

const REPORT_TTL_MS = 24 * 60 * 60 * 1000;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function generateExcelReport(data, fileNamePrefix = 'Report') {
  const id = newId();
  const filename = `${fileNamePrefix}_${Date.now()}.xlsx`;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  await getDb().collection('reports').doc(id).set({
    filename,
    content: buffer.toString('base64'),
    createdAt: new Date(),
    expireAt: new Date(Date.now() + REPORT_TTL_MS),
  });

  return {
    filename,
    downloadUrl: `/api/reports/${id}`,
  };
}

/** GET /api/reports/:id — tải file báo cáo đã tạo */
async function downloadReport(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ message: 'Không tìm thấy báo cáo.' });
    const snap = await getDb().collection('reports').doc(req.params.id).get();
    const report = snap.exists ? snap.data() : null;
    if (!report || report.expireAt.toDate() < new Date()) {
      return res.status(404).json({ message: 'Báo cáo không tồn tại hoặc đã hết hạn.' });
    }
    res.setHeader('Content-Type', XLSX_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    return res.send(Buffer.from(report.content, 'base64'));
  } catch (error) {
    console.error('[Reports] download error:', error.message);
    return res.status(500).json({ message: 'Không thể tải báo cáo.' });
  }
}

module.exports = { generateExcelReport, downloadReport };
