const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { extractSheetId } = require('../services/sheetsSync');
const { exportAllToSpreadsheets } = require('../services/reportExport');

const GROUPS = ['admin', 'ops_head', 'hr'];

async function getReportSheets() {
  const { data } = await supabase.from('platform_config').select('value').eq('key', 'reportSheets').maybeSingle();
  if (!data || !data.value) return [];
  try {
    const parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveReportSheets(list) {
  await supabase.from('platform_config').upsert({ key: 'reportSheets', value: JSON.stringify(list) }, { onConflict: 'key' });
}

const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null;

// GET /api/reports/sheets - List configured report sheets
router.get('/sheets', authenticateToken, requireRoles(GROUPS), async (req, res) => {
  try {
    const sheets = await getReportSheets();
    return res.json({ sheets, serviceAccountEmail: SA_EMAIL });
  } catch (error) {
    console.error('List report sheets error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/reports/sheets - Add a report sheet
router.post('/sheets', authenticateToken, requireRoles(['admin']), async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!url) return res.status(400).json({ message: 'Google Sheet URL is required.' });
    if (!extractSheetId(url)) return res.status(400).json({ message: 'Could not read the spreadsheet ID from that URL.' });

    const sheets = await getReportSheets();
    if (sheets.some(s => s.url === url)) {
      return res.status(400).json({ message: 'That sheet is already configured.' });
    }

    const sheet = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || 'Reports',
      url,
      createdAt: new Date().toISOString(),
      lastExportedAt: null,
    };
    sheets.push(sheet);
    await saveReportSheets(sheets);

    return res.status(201).json({
      message: 'Report sheet added. Share the sheet with the service account to export.',
      sheet,
      serviceAccountEmail: SA_EMAIL,
    });
  } catch (error) {
    console.error('Add report sheet error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/reports/sheets/:id - Remove a report sheet
router.delete('/sheets/:id', authenticateToken, requireRoles(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    let sheets = await getReportSheets();
    const before = sheets.length;
    sheets = sheets.filter(s => s.id !== id);
    if (sheets.length === before) {
      return res.status(404).json({ message: 'Report sheet not found.' });
    }
    await saveReportSheets(sheets);
    return res.json({ message: 'Report sheet removed.' });
  } catch (error) {
    console.error('Remove report sheet error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/reports/sheets/export - Push all reports to every configured sheet
router.post('/sheets/export', authenticateToken, requireRoles(GROUPS), async (req, res) => {
  try {
    const result = await exportAllToSpreadsheets();
    if (!result.ok) {
      return res.json({ message: result.error || 'Export completed with errors.', ...result });
    }
    const details = result.exports.map(e => `${e.name || 'Unnamed'} → ${(e.tabs || []).map(t => `${t.tab} (${t.rows} rows)`).join(', ')}`).join(' | ');
    return res.json({ message: `Exported successfully. ${details}`, result: result.exports });
  } catch (error) {
    console.error('Export reports error:', error);
    return res.status(500).json({ message: 'Export failed: ' + error.message });
  }
});

module.exports = router;