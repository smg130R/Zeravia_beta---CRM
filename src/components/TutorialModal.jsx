import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, LayoutDashboard, TableProperties, Network, ClipboardList, Users, PhoneCall, Target, CalendarDays, BarChart3, ShieldAlert, Settings, HelpCircle, Bell } from 'lucide-react';

const steps = [
  {
    title: 'Welcome to Zeravia_beta---CRM',
    icon: HelpCircle,
    content: 'This walkthrough covers the main features. Use the arrows or dots to navigate. Click the help icon anytime to reopen.',
    color: '#2563EB',
  },
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    content: 'Your HQ. View KPI cards (Calls, Connects, Deals), charts, team breakdown (admin), low-performance alerts, and a date filter to toggle Today / 7 Days / 30 Days.',
    color: '#2563EB',
  },
  {
    title: 'KPI Board',
    icon: TableProperties,
    content: 'Performance table showing MC1 / MC2 metrics, screenshots, prospects, and sales calls for all team members. Sortable columns with progress bars.',
    color: '#16A34A',
  },
  {
    title: 'Team Structure',
    icon: Network,
    content: 'Org chart hierarchy and a team table with per-member stats (calls, connects, deals, score). Click any row to drill into details.',
    color: '#7C3AED',
  },
  {
    title: 'Lead Workspace (TL)',
    icon: ClipboardList,
    content: 'Import leads from master sheet, distribute to BDAs, view assignment history, and manage BDA sheet URLs. Manually select leads and assign to specific BDAs.',
    color: '#F59E0B',
  },
  {
    title: 'Employee Master',
    icon: Users,
    content: 'Directory of all employees. Add new employees, edit roles, remove suspended users, and manage credentials. Search by name, email, or role.',
    color: '#DC2626',
  },
  {
    title: 'Marketing Calls (BDA)',
    icon: PhoneCall,
    content: 'Your calling sheet. Fetch 50 leads at a time, mark status after each call, log remarks. Completed leads auto-clear when you fetch the next batch. Follow-ups tab tracks callbacks.',
    color: '#16A34A',
  },
  {
    title: 'Prospects',
    icon: Target,
    content: 'Manage registrations and conversions. Add/edit prospect records, track slot bookings, payments, and status. Filter by status or payment type.',
    color: '#F97316',
  },
  {
    title: 'Follow-ups',
    icon: CalendarDays,
    content: 'All pending callbacks in one place. Color-coded by urgency (red = missed, amber = due today). Mark as Completed or No Answer directly.',
    color: '#0891B2',
  },
  {
    title: 'Reports',
    icon: BarChart3,
    content: 'Visual analytics — call trends, team comparisons, and conversion funnels. Date range filter (Today / 7 Days / 30 Days) with auto-refresh every 15s.',
    color: '#7C3AED',
  },
  {
    title: 'HR Desk',
    icon: ShieldAlert,
    content: 'Announcements, leave management, and employee celebrations (birthdays, work anniversaries). Submit and track leave requests.',
    color: '#7C3AED',
  },
  {
    title: 'Settings',
    icon: Settings,
    content: 'Configure KPI targets, integration URLs, and team parameters. Only accessible by admin and team leads.',
    color: '#6B7280',
  },
  {
    title: 'Notifications & Profile',
    icon: Bell,
    content: 'Bell icon opens your notification panel — pings, alerts, and updates. Click your name/avatar in the header to update your password, personal info, or toggle dark mode.',
    color: '#2563EB',
  },
];

const TutorialModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);
  const total = steps.length;

  if (!isOpen) return null;

  const current = steps[step];
  const Icon = current.icon;

  const goNext = () => { if (step < total - 1) setStep(s => s + 1); };
  const goPrev = () => { if (step > 0) setStep(s => s - 1); };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)',
      padding: '1rem',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)', width: 520, maxWidth: '100%',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '1.5rem 1.5rem 0', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: current.color + '18', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={22} color={current.color} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{current.title}</h2>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Step {step + 1} of {total}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: 4, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{
          padding: '1.25rem 1.5rem', flex: 1,
          fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)',
          minHeight: 100,
        }}>
          {current.content}
        </div>

        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button
            onClick={goPrev}
            disabled={step === 0}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.9rem', fontSize: 13, opacity: step === 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} /> Back
          </button>

          <div style={{ display: 'flex', gap: 5 }}>
            {steps.map((_, i) => (
              <div key={i} onClick={() => setStep(i)} style={{
                width: i === step ? 20 : 7, height: 7, borderRadius: 4,
                background: i === step ? current.color : 'var(--border)',
                cursor: 'pointer', transition: 'all 0.2s',
              }} />
            ))}
          </div>

          {step < total - 1 ? (
            <button onClick={goNext} className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: 13 }}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={onClose} className="btn btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: 13 }}>
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
