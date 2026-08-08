const supabase = require('../db/supabase');
const { getSheetsClient, extractSheetId } = require('./sheetsSync');

// ── Date helpers ──

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().split('T')[0];
}

// ── Data gathering ──

async function fetchKpi(start, end) {
  const { data } = await supabase
    .from('kpi_records')
    .select('"userId", date, "mCalls", "mConn", "mSS", "mPros", "eCalls", "eConn", "eSS", "ePros", deals, followups, "perfScore"')
    .gte('date', start)
    .lte('date', end);
  return data || [];
}

async function fetchUsers() {
  const { data } = await supabase.from('users').select('id, name, role, "teamId", status').order('name');
  const { data: teams } = await supabase.from('teams').select('id, name');
  const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t.name]));
  return (data || []).map(u => ({
    ...u,
    teamName: teamMap[u.teamId] || (u.teamId ? u.teamId : 'Unassigned'),
  }));
}

function aggregateKpi(rows) {
  const byUser = {};
  for (const r of rows) {
    const calls = (r.mCalls || 0) + (r.eCalls || 0);
    const connects = (r.mConn || 0) + (r.eConn || 0);
    if (!byUser[r.userId]) {
      byUser[r.userId] = { calls: 0, connects: 0, screenshots: 0, prospects: 0, deals: 0, followups: 0, scoreSum: 0, daysActive: 0 };
    }
    byUser[r.userId].calls += calls;
    byUser[r.userId].connects += connects;
    byUser[r.userId].screenshots += (r.mSS || 0) + (r.eSS || 0);
    byUser[r.userId].prospects += (r.mPros || 0) + (r.ePros || 0);
    byUser[r.userId].deals += r.deals || 0;
    byUser[r.userId].followups += r.followups || 0;
    if (calls > 0 || (r.deals || 0) > 0) {
      byUser[r.userId].scoreSum += r.perfScore || 0;
      byUser[r.userId].daysActive++;
    }
  }
  return byUser;
}

// ── Report builders (array-of-arrays, row 0 = header) ──

const KPI_HEADER = ['Name', 'Role', 'Team', 'Calls', 'Connects', 'Connect Rate %', 'Screenshots', 'Prospects', 'Follow-ups', 'Deals', 'Avg Perf Score', 'Days Active'];

function kpiTable(users, kpis) {
  const agg = aggregateKpi(kpis);
  const rows = users.map(u => {
    const a = agg[u.id] || { calls: 0, connects: 0, screenshots: 0, prospects: 0, deals: 0, followups: 0, scoreSum: 0, daysActive: 0 };
    return [
      u.name || 'N/A',
      u.role || '-',
      u.teamName || '',
      a.calls,
      a.connects,
      a.calls > 0 ? Number(((a.connects / a.calls) * 100).toFixed(1)) : 0,
      a.screenshots,
      a.prospects,
      a.followups,
      a.deals,
      a.daysActive > 0 ? Number((a.scoreSum / a.daysActive).toFixed(2)) : 0,
      a.daysActive,
    ];
  });
  return [KPI_HEADER, ...rows];
}

function teamSummary(users, monthlyKpis) {
  const agg = aggregateKpi(monthlyKpis);
  const byTeam = {};
  for (const u of users) {
    const key = u.teamName || 'Unassigned';
    if (!byTeam[key]) byTeam[key] = { members: 0, calls: 0, connects: 0, deals: 0, scoreSum: 0, days: 0 };
    byTeam[key].members++;
    const a = agg[u.id];
    if (a) {
      byTeam[key].calls += a.calls;
      byTeam[key].connects += a.connects;
      byTeam[key].deals += a.deals;
      byTeam[key].scoreSum += a.scoreSum;
      byTeam[key].days += a.daysActive;
    }
  }
  const rows = [['Team', 'Members', 'Calls', 'Connects', 'Connect Rate %', 'Deals', 'Avg Perf Score']];
  for (const [name, t] of Object.entries(byTeam)) {
    rows.push([
      name,
      t.members,
      t.calls,
      t.connects,
      t.calls > 0 ? Number(((t.connects / t.calls) * 100).toFixed(1)) : 0,
      t.deals,
      t.days > 0 ? Number((t.scoreSum / t.days).toFixed(2)) : 0,
    ]);
  }
  return rows;
}

function funnelTable(weeklyKpis, monthlyKpis) {
  const sum = (kpis) => {
    const a = aggregateKpi(kpis);
    return Object.values(a).reduce(
      (s, x) => ({ calls: s.calls + x.calls, connects: s.connects + x.connects, prospects: s.prospects + x.prospects, deals: s.deals + x.deals }),
      { calls: 0, connects: 0, prospects: 0, deals: 0 }
    );
  };
  const w = sum(weeklyKpis);
  const m = sum(monthlyKpis);
  return [
    ['Stage', 'Weekly (7 days)', 'Monthly (30 days)'],
    ['Total Calls', w.calls, m.calls],
    ['Connects', w.connects, m.connects],
    ['Connect Rate %', w.calls > 0 ? Number(((w.connects / w.calls) * 100).toFixed(1)) : 0, m.calls > 0 ? Number(((m.connects / m.calls) * 100).toFixed(1)) : 0],
    ['Prospects', w.prospects, m.prospects],
    ['Deals', w.deals, m.deals],
    ['Deal Rate % (of prospects)', w.prospects > 0 ? Number(((w.deals / w.prospects) * 100).toFixed(1)) : 0, m.prospects > 0 ? Number(((m.deals / m.prospects) * 100).toFixed(1)) : 0],
  ];
}

// ── Build all tabs for a spreadsheet ──

async function buildTabs() {
  const today = todayStr();
  const weekStart = dateDaysAgo(7);
  const monthStart = dateDaysAgo(30);

  const [users, weeklyKpis, monthlyKpis] = await Promise.all([
    fetchUsers(),
    fetchKpi(weekStart, today),
    fetchKpi(monthStart, today),
  ]);

  return {
    tabs: {
      'Monthly KPI': kpiTable(users, monthlyKpis),
      'Weekly KPI': kpiTable(users, weeklyKpis),
      'Team Performance': teamSummary(users, monthlyKpis),
      'Conversion Funnel': funnelTable(weeklyKpis, monthlyKpis),
    },
    meta: { weekStart, monthStart, today },
  };
}

// ── Sheet writing ──

async function ensureTabs(sheets, spreadsheetId, tabNames) {
  const resp = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const existing = new Set((resp.data.sheets || []).map(s => s.properties.title));
  for (const title of tabNames) {
    if (!existing.has(title)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title } } }],
        },
      });
    }
  }
}

async function writeTab(sheets, spreadsheetId, tab, values) {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${tab}!A1:Z1000` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

async function exportToSpreadsheet(sheetId) {
  const sheets = await getSheetsClient();
  if (!sheets) return { ok: false, tabs: [], error: 'Google Sheets credentials are not configured.' };

  const { tabs } = await buildTabs();
  const results = [];
  await ensureTabs(sheets, sheetId, Object.keys(tabs));
  for (const [tab, values] of Object.entries(tabs)) {
    try {
      await writeTab(sheets, sheetId, tab, values);
      results.push({ tab, rows: values.length });
    } catch (err) {
      results.push({ tab, error: err.message });
    }
  }
  const failed = results.filter(r => r.error);
  return {
    ok: failed.length === 0,
    tabs: results,
    error: failed.length ? `Failed to write: ${failed.map(r => `${r.tab} (${r.error})`).join('; ')}` : null,
  };
}

async function exportAllToSpreadsheets() {
  const { data: cfg } = await supabase.from('platform_config').select('value').eq('key', 'reportSheets').maybeSingle();
  let sheets = [];
  if (cfg && cfg.value) {
    try { sheets = JSON.parse(cfg.value); } catch { sheets = []; }
  }
  if (!sheets || sheets.length === 0) {
    return { ok: false, error: 'No report sheets configured. Add a Google Sheet first.', exports: [] };
  }

  const exports = [];
  for (const cfg of sheets) {
    const sheetId = extractSheetId(cfg.url);
    if (!sheetId) {
      exports.push({ id: cfg.id, name: cfg.name || 'Unnamed', ok: false, error: 'Invalid sheet URL.' });
      continue;
    }
    try {
      const result = await exportToSpreadsheet(sheetId);
      cfg.lastExportedAt = new Date().toISOString();
      await supabase.from('platform_config').upsert({ key: 'reportSheets', value: JSON.stringify(sheets) }, { onConflict: 'key' });
      exports.push({ id: cfg.id, name: cfg.name || 'Unnamed', ok: result.ok, tabs: result.tabs, error: result.error });
    } catch (err) {
      exports.push({ id: cfg.id, name: cfg.name || 'Unnamed', ok: false, error: err.message });
    }
  }
  return { ok: exports.every(e => e.ok), exports };
}

module.exports = { buildTabs, exportToSpreadsheet, exportAllToSpreadsheets };