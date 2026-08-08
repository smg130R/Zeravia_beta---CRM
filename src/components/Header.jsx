import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, HelpCircle, Menu, AlertCircle } from 'lucide-react';

const titleMap = {
  dashboard: { title: 'Dashboard', subtitle: 'Overall performance & company metrics' },
  'kpi-board': { title: 'KPI Board', subtitle: 'MC1 / MC2 / Sales & Follow-up performance' },
  'team-structure': { title: 'Team Structure', subtitle: 'Company hierarchy & sales divisions' },
  'team-lead-workspace': { title: 'Lead Workspace', subtitle: 'Master sheet & lead distribution' },
  'employee-master': { title: 'Employee Master', subtitle: 'Company employee directory' },
  'marketing-calling': { title: 'Marketing Calls', subtitle: 'Customer calling sheets' },
  prospects: { title: 'Prospects', subtitle: 'Registrations & conversions' },
  'follow-ups': { title: 'Follow-ups', subtitle: 'Pending callbacks & lead statuses' },
  reports: { title: 'Reports', subtitle: 'Visual analytics & conversion ratios' },
  settings: { title: 'Settings', subtitle: 'Integrations & KPI targets' },
};

const roleColors = {
  admin: '#DC2626', ops_head: '#2563EB', hr: '#7C3AED',
  team_lead: '#F59E0B', bda: '#16A34A',
};
const roleLabels = {
  admin: 'Admin', ops_head: 'Ops Head', hr: 'HR Lead',
  team_lead: 'Team Lead', bda: 'BDA',
};

const Header = ({ activePage, dateFilter, setDateFilter, onOpenComplaintModal, setSidebarOpen, onOpenProfile, onOpenNotifications, onOpenHelp }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread || 0);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchUnread(); const i = setInterval(fetchUnread, 30000); return () => clearInterval(i); }, []);

  if (!user) return null;

    const info = titleMap[activePage] || { title: 'Zeravia_beta---CRM', subtitle: '' };

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="btn-ghost" onClick={() => setSidebarOpen(true)}
          style={{ display: 'none', padding: 8 }} id="menu-toggle-btn">
          <Menu size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{info.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 1 }}>{info.subtitle}</p>
        </div>
      </div>

      <div className="header-right">
        {['dashboard', 'kpi-board', 'reports'].includes(activePage) && (
          <div className="header-date-filter">
            {['Today', '7 Days', '30 Days'].map(d => (
              <button key={d} className={dateFilter === d ? 'active' : ''} onClick={() => setDateFilter(d)}>{d}</button>
            ))}
          </div>
        )}

        {user.role === 'bda' && (
          <button className="btn btn-danger" onClick={onOpenComplaintModal} style={{ height: 36, padding: '0 14px', fontSize: 13 }}>
            <AlertCircle size={14} /> File Complaint
          </button>
        )}

        <button className="header-icon-btn" title="Notifications" onClick={onOpenNotifications}>
          <Bell size={18} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16,
              borderRadius: 8, background: 'var(--danger)', color: '#fff',
              fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: '0 3px', border: '2px solid var(--bg-card)',
            }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>

        <button className="header-icon-btn" title="Help" onClick={onOpenHelp}>
          <HelpCircle size={18} />
        </button>

        <div className="header-profile-card" onClick={onOpenProfile} style={{ cursor: 'pointer' }}>
          <div className="header-avatar" style={{ background: roleColors[user.role] || '#2563EB' }}>
            {user.role.slice(0, 2).toUpperCase()}
          </div>
          <div className="header-profile-info">
            <span className="header-profile-name">{user.name}</span>
            <span className="header-profile-role">{roleLabels[user.role] || user.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
