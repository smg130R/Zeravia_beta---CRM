import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, TableProperties, Network, Users, PhoneCall,
  CalendarDays, BarChart3, ShieldAlert, Settings, LogOut,
  ClipboardList, Target, Search, ChevronDown, Briefcase, FileText,
  Clock, Megaphone, BookOpen, Heart
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'kpi-board', name: 'KPI Board', icon: TableProperties },
  { id: 'team-structure', name: 'Team Structure', icon: Network },
  { id: 'team-lead-workspace', name: 'Lead Workspace', icon: ClipboardList },
  { id: 'employee-master', name: 'Employee Master', icon: Users },
  { id: 'marketing-calling', name: 'Marketing Calls', icon: PhoneCall },
  { id: 'prospects', name: 'Prospects', icon: Target },
  { id: 'follow-ups', name: 'Follow-ups', icon: CalendarDays },
  { id: 'reports', name: 'Reports', icon: BarChart3 },
  // HR section
  { id: 'hr-planner', name: 'HR Planner', icon: CalendarDays },
  { id: 'hr-recruitment', name: 'Recruitment', icon: Briefcase },
  { id: 'hr-documents', name: 'Documents', icon: FileText },
  { id: 'hr-attendance', name: 'Attendance', icon: Clock },
  { id: 'hr-announcements', name: 'Announcements', icon: Megaphone },
  { id: 'hr-policies', name: 'Policies', icon: BookOpen },
  { id: 'settings', name: 'Settings', icon: Settings },
];

const permissions = {
  admin: [
    'dashboard','kpi-board','team-structure','employee-master','reports',
    'hr-planner','hr-recruitment','hr-documents','hr-attendance',
    'hr-announcements','hr-policies','settings',
    'marketing-calling','prospects','follow-ups','team-lead-workspace',
  ],
  ops_head: [
    'dashboard','kpi-board','team-structure','follow-ups','reports',
    'hr-announcements','hr-policies','settings',
  ],
  hr: [
    'dashboard','employee-master',
    'hr-planner','hr-recruitment','hr-documents','hr-attendance',
    'hr-announcements','hr-policies','settings',
  ],
  team_lead: [
    'dashboard','kpi-board','team-structure','employee-master',
    'prospects','follow-ups','reports','team-lead-workspace',
    'hr-announcements','hr-policies',
  ],
  bda: [
    'dashboard','marketing-calling','follow-ups','prospects',
    'hr-announcements',
  ],
};

const roleMeta = {
  admin: { title: 'System Admin', color: '#DC2626', avatar: 'AD' },
  ops_head: { title: 'Operations Director', color: '#2563EB', avatar: 'OP' },
  hr: { title: 'HR Lead', color: '#7C3AED', avatar: 'HR' },
  team_lead: { title: 'Team Lead', color: '#F59E0B', avatar: 'TL' },
  bda: { title: 'BDA', color: '#16A34A', avatar: 'BD' },
};

const Sidebar = ({ activePage, setActivePage, sidebarOpen, setSidebarOpen }) => {
  const { user, logout } = useAuth();
  if (!user) return null;

  const meta = roleMeta[user.role] || { title: user.role, color: '#6B7280', avatar: user.role.slice(0,2).toUpperCase() };
  const allowed = permissions[user.role] || ['dashboard'];

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <img src="/Z_logo.jpeg" alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>Zeravia_beta---CRM</span>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(item => {
            if (!allowed.includes(item.id)) return null;
            const Icon = item.icon;
            const active = item.id === activePage;
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
                style={{ fontSize: 14, paddingLeft: 16 }}
                onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar" style={{ background: meta.color }}>{meta.avatar}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="sidebar-user-role">{meta.title}</span>
            </div>
          </div>
          <button className="sidebar-logout-btn" onClick={logout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
