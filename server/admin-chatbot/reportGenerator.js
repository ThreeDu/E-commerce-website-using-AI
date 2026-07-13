/**
 * reportGenerator.js — Generates Excel / CSV reports for Admin chatbot.
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const REPORTS_DIR = path.join(__dirname, '../../public/reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function generateExcelReport(data, fileNamePrefix = 'Report') {
  const filename = `${fileNamePrefix}_${Date.now()}.xlsx`;
  const filePath = path.join(REPORTS_DIR, filename);

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  XLSX.writeFile(workbook, filePath);

  return {
    filename,
    filePath,
    downloadUrl: `/reports/${filename}`,
  };
}

module.exports = { generateExcelReport };
