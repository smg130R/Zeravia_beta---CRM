import React, { useState, useEffect, useCallback } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { ArrowLeft, Users, PhoneCall, Trophy, Crosshair, FileSpreadsheet, Plus, Trash2, Send, Loader, ExternalLink, Link2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const COLORS = { primary: '#3b82f6', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', purple: '#8b5cf6', coral: '#f97316', grid: '#e2e8f0' };
const TEAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#f97316', '#06b6d4', '#ec4899'];

const rangeMap = { 'Today': 'today', '7 Days': 'weekly', '30 Days': 'monthly' };

const Reports = ({ dateFilter = '7 Days', showToast }) => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberLoading, setMemberLoading] = useState(false);

  // Google Sheets reports export (Admin / Ops / HR)
  const [reportSheets, setReportSheets] = useState([]);
  const [reportSaEmail, setReportSaEmail] = useState(null);
  const [reportName, setReportName] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [addingReport, setAddingReport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canManageReports = ['admin', 'ops_head', 'hr'].includes(user?.role);

  const fetchReportSheets = async () => {
    if (!canManageReports) return;
    try {
      const res = await fetch('/api/reports/sheets', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setReportSheets(data.sheets || []);
        setReportSaEmail(data.serviceAccountEmail || null);
      }
    } catch (e) { console.error('Fetch report sheets error:', e); }
  };

  useEffect(() => {
    fetchTeams();
    const i = setInterval(fetchTeams, 15000);
    if (canManageReports) fetchReportSheets();
    return () => clearInterval(i);
  }, [dateFilter, canManageReports]);

  const addReportSheet = async () => {
    if (!reportUrl.trim()) return showToast('Paste the Google Sheet URL first.', true);
    setAddingReport(true);
    try {
      const res = await fetch('/api/reports/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: reportName.trim(), url: reportUrl.trim() }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setReportName('');
        setReportUrl('');
        setReportSaEmail(data.serviceAccountEmail || reportSaEmail);
        showToast(data.message || 'Report sheet added.');
        fetchReportSheets();
      } else {
        showToast(data.message || 'Failed to add sheet.', true);
      }
    } catch (e) {
      showToast('Connection error while adding sheet.', true);
    } finally {
      setAddingReport(false);
    }
  };

  const removeReportSheet = async (id) => {
    if (!window.confirm('Remove this report sheet?')) return;
    try {
      const res = await fetch(`/api/reports/sheets/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        fetchReportSheets();
      } else {
        showToast(data.message || 'Failed to remove sheet.', true);
      }
    } catch (e) {
      showToast('Connection error.', true);
    }
  };

  const exportReports = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/sheets/export', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Reports exported.');
        fetchReportSheets();
      } else {
        showToast(data.message || 'Export failed.', true);
      }
    } catch (e) {
      showToast('Connection error while exporting.', true);
    } finally {
      setExporting(false);
    }
  };

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const range = rangeMap[dateFilter] || 'today';
      const res = await fetch(`/api/kpi/teams-breakdown?range=${range}`, { credentials: 'include' });
      if (res.ok) setTeams((await res.json()).teams || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchMembers = useCallback(async (teamId) => {
    setMemberLoading(true);
    try {
      const range = rangeMap[dateFilter] || 'today';
      const res = await fetch(`/api/kpi/team-members/${teamId}?range=${range}`, { credentials: 'include' });
      if (res.ok) setMembers((await res.json()).members || []);
    } catch (e) { console.error(e); }
    finally { setMemberLoading(false); }
  }, [dateFilter]);

  const handleDrill = (idx) => {
    if (!teams[idx]) return;
    const team = teams[idx];
    setSelectedTeam(team);
    fetchMembers(team.id);
  };

  const totalCalls = teams.reduce((s, t) => s + t.calls, 0);
  const totalConnects = teams.reduce((s, t) => s + t.connects, 0);
  const totalDeals = teams.reduce((s, t) => s + t.deals, 0);

  const teamChartOptions = (drillFn) => ({
    responsive: true, maintainAspectRatio: false,
    onClick: (_, els) => { if (els.length > 0) drillFn(els[0].dataIndex); },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}` } },
    },
    scales: { y: { beginAtZero: true, grid: { color: COLORS.grid } }, x: { grid: { display: false } } },
  });

  const memberChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}` } } },
    scales: { y: { beginAtZero: true, grid: { color: COLORS.grid } }, x: { grid: { display: false } } },
  };

  if (loading) {
    return <div className="view-section active" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading reports...</div>;
  }

  return (
    <div className="view-section active">
      {canManageReports && (
        <div className="content-card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileSpreadsheet size={18} /> Google Sheets Reports Export
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
              Add a Google Spreadsheet and its Monthly KPI, Weekly KPI, Team Performance and Conversion Funnel tabs are written on export.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Sheet name (e.g. March Reports)"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'var(--font-family)',
              }}
            />
            <input
              type="text"
              placeholder="Google Spreadsheet URL (https://docs.google.com/spreadsheets/d/...)"
              value={reportUrl}
              onChange={(e) => setReportUrl(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'var(--font-family)',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={addReportSheet}
              disabled={addingReport}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              {addingReport ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />} Add Sheet
            </button>
            <button
              className="btn btn-secondary"
              onClick={exportReports}
              disabled={exporting || reportSheets.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              title={reportSheets.length === 0 ? 'Add a sheet first' : 'Export reports to all configured sheets'}
            >
              {exporting ? <Loader size={14} className="animate-spin" /> : <Send size={14} />} {exporting ? 'Exporting...' : 'Export Reports Now'}
            </button>
            {reportSaEmail && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Share each sheet as Editor with <strong style={{ color: 'var(--text-primary)' }}>{reportSaEmail}</strong>
              </span>
            )}
          </div>

          {reportSheets.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
              No report sheets configured yet.
            </p>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Sheet</th>
                    <th>Last Exported</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportSheets.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name || 'Reports'}</td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Link2 size={12} /> Open Sheet <ExternalLink size={10} />
                        </a>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.lastExportedAt ? new Date(s.lastExportedAt).toLocaleString() : 'Never'}</td>
                      <td>
                        <button className="btn btn-danger" onClick={() => removeReportSheet(s.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Trash2 size={12} /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedTeam && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => { setSelectedTeam(null); setMembers([]); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={14} /> Back to All Teams
          </button>
        </div>
      )}

      {selectedTeam ? (
        <>
          <div className="content-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} /> {selectedTeam.name} — Member Reports
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="dashboard-charts-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))' }}>
            <div className="chart-card">
              <div className="chart-header"><h3>Total Calls per Member</h3></div>
              <div className="chart-container" style={{ height: '300px' }}>
                {members.length ? (
                  <Bar data={{
                    labels: members.map(m => m.name),
                    datasets: [{ label: 'Calls', data: members.map(m => m.mCalls + m.eCalls), backgroundColor: TEAM_COLORS[0], borderRadius: 6 }]
                  }} options={memberChartOptions} />
                ) : <EmptyChart />}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header"><h3>Connects per Member</h3></div>
              <div className="chart-container" style={{ height: '300px' }}>
                {members.length ? (
                  <Bar data={{
                    labels: members.map(m => m.name),
                    datasets: [{ label: 'Connects', data: members.map(m => m.mConn + m.eConn), backgroundColor: COLORS.success, borderRadius: 6 }]
                  }} options={memberChartOptions} />
                ) : <EmptyChart />}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header"><h3>Deals per Member</h3></div>
              <div className="chart-container" style={{ height: '300px' }}>
                {members.length ? (
                  <Bar data={{
                    labels: members.map(m => m.name),
                    datasets: [{ label: 'Deals', data: members.map(m => m.deals), backgroundColor: COLORS.purple, borderRadius: 6 }]
                  }} options={memberChartOptions} />
                ) : <EmptyChart />}
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header"><h3>Performance Score per Member</h3></div>
              <div className="chart-container" style={{ height: '300px' }}>
                {members.length ? (
                  <Bar data={{
                    labels: members.map(m => m.name),
                    datasets: [{ label: 'Perf Score', data: members.map(m => m.perfScore), backgroundColor: COLORS.warning, borderRadius: 6 }]
                  }} options={memberChartOptions} />
                ) : <EmptyChart />}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="dashboard-charts-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))' }}>
          {/* Call Distribution by Team */}
          <div className="chart-card">
            <div className="chart-header">
              <h3><PhoneCall size={16} /> Call Distribution by Team</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click a bar to drill down</span>
            </div>
            <div className="chart-container" style={{ height: '300px' }}>
              {teams.length ? (
                <Bar data={{
                  labels: teams.map(t => t.name),
                  datasets: [{ label: 'Calls', data: teams.map(t => t.calls), backgroundColor: teams.map((_, i) => TEAM_COLORS[i % TEAM_COLORS.length]), borderRadius: 6 }]
                }} options={teamChartOptions(handleDrill)} />
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Connects by Team */}
          <div className="chart-card">
            <div className="chart-header">
              <h3><PhoneCall size={16} /> Connects by Team</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click a bar to drill down</span>
            </div>
            <div className="chart-container" style={{ height: '300px' }}>
              {teams.length ? (
                <Bar data={{
                  labels: teams.map(t => t.name),
                  datasets: [{ label: 'Connects', data: teams.map(t => t.connects), backgroundColor: teams.map((_, i) => TEAM_COLORS[i % TEAM_COLORS.length]), borderRadius: 6 }]
                }} options={teamChartOptions(handleDrill)} />
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Deals by Team */}
          <div className="chart-card">
            <div className="chart-header">
              <h3><Trophy size={16} /> Deals by Team</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click a bar to drill down</span>
            </div>
            <div className="chart-container" style={{ height: '300px' }}>
              {teams.length ? (
                <Bar data={{
                  labels: teams.map(t => t.name),
                  datasets: [{ label: 'Deals', data: teams.map(t => t.deals), backgroundColor: teams.map((_, i) => TEAM_COLORS[i % TEAM_COLORS.length]), borderRadius: 6 }]
                }} options={teamChartOptions(handleDrill)} />
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Connection Rate by Team */}
          <div className="chart-card">
            <div className="chart-header">
              <h3><Crosshair size={16} /> Connection Rate by Team</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click a segment to drill down</span>
            </div>
            <div className="chart-container" style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
              {teams.length ? (
                <Doughnut data={{
                  labels: teams.map(t => t.name),
                  datasets: [{ data: teams.map(t => t.calls), backgroundColor: teams.map((_, i) => TEAM_COLORS[i % TEAM_COLORS.length]), borderWidth: 2 }]
                }} options={{
                  responsive: true, maintainAspectRatio: false,
                  onClick: (_, els) => { if (els.length > 0) handleDrill(els[0].dataIndex); },
                  plugins: { legend: { position: 'bottom' } }
                }} />
              ) : <EmptyChart />}
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Total Teams', value: teams.length, color: COLORS.primary, icon: Users },
              { label: 'Total Calls', value: totalCalls, color: COLORS.success, icon: PhoneCall },
              { label: 'Total Connects', value: totalConnects, color: COLORS.warning, icon: PhoneCall },
              { label: 'Total Deals', value: totalDeals, color: COLORS.purple, icon: Trophy },
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: s.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                  <s.icon size={22} />
                </div>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.value}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyChart = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
    No data available
  </div>
);

export default Reports;