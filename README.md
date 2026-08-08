# Zeravia_beta---CRM

Enterprise-grade CRM for managing sales teams, calling operations, lead distribution, and performance analytics. Built with React + Vite frontend, Express backend, Supabase (PostgreSQL), and Google Sheets integration.

## Features

### 🔐 Authentication & Roles
- Email/password login with JWT tokens
- 5 role tiers: **Admin**, **Ops Head**, **HR Lead**, **Team Lead**, **BDA**
- Role-based routing — each role sees only their relevant pages
- Profile modal (click user name) — update name, email, phone, birthday, password, and toggle dark mode

### 📊 Dashboard
- Role-specific KPI cards: Calls, Connects, Connection Rate, Prospects, Screenshots, Sales Calls, Deals Closed
- Date filter: Today / 7 Days / 30 Days — each returns different aggregated data
- **Admin**: team breakdown bar chart, clickable team cards → drill into per-BDA members with calls/connects/deals/score
- **Team Lead**: low fresh-leads red banner (< 150 unassigned), per-BDA breakdown on card click
- **BDA**: personal stats, slot bookings, collected/outstanding payments
- KPI cards are clickable → detail modal with per-team/per-BDA breakdown
- Live polling every 15 seconds

### 👥 Employee Master
- Full employee directory with search (name, email, role)
- Add Employee modal with manual Employee ID entry, password strength meter, password generation, role dropdown with icons
- Edit employee details inline
- Remove employees (deactivates user, unassigns leads/prospects, deletes calling sheet, deletes Supabase Auth user)
- Employee status: active / suspended

### 👑 Team Lead Workspace
- **Master Sheet**: paste Google Sheet URL, import leads (auto-detects columns by header name)
- **Lead Distribution**: auto-distribute unassigned leads to present BDAs (skips BDAs with pending leads)
- **Manual Assign**: select specific leads via checkbox → pick a BDA → assign (creates calling sheet + assignment history)
- **Leads table**: view all leads (unassigned/assigned/NA/dropped), count badges
- **Assignment History**: full audit trail of who assigned what to whom
- **BDA Sheets**: configure each BDA's assigned and prospect sheet URLs
- **Calling Sheets**: view all BDAs' calling entries, filter by BDA, bulk remove
- **Reassign NA**: pull NA leads back to the pool and redistribute
- **Deduplicate**: merge duplicate leads by contact number
- Low fresh-leads warning banner

### 📞 Marketing Calls (BDA)
- **50-lead batch system**: only 50 active leads at a time. Completed leads auto-remove when fetching next batch
- If more leads are already assigned (but inactive), they activate first before fetching from the pool
- **Status dropdown**: NA, NI, FORM SHARED, SCREENSHOT SHARED, BUSY, SWITCH OFF, NOT YET REPLIED, CALL BACK, OUT OF SERVICE, WRONG NUMBER, RESPONDED
- **Search bar**: filter table by name, contact, college, branch, or remarks
- **Column resize**: drag column edge to resize
- **Column reorder**: drag header left/right to reorder
- **Click-to-copy**: contact numbers copy to clipboard on click
- **WhatsApp**: separate WhatsApp number shown under contact when different
- **Follow-ups tab**: color-coded (red = missed, amber = due today), mark as Completed/No Answer
- Remarks logging with auto-blur save

### 🎯 Prospects
- Full prospect management: name, contact, email, college, branch, year, domain, state
- Status tracking: New, Contacted, Qualified, Enrolled, Dropped
- Payment tracking: slot amount, amount paid, outstanding
- Inline editing and status/payment filters
- Add/edit/delete prospects

### 📅 Follow-ups
- Consolidated view of all pending callbacks
- Color-coded urgency: red = missed date, amber = due today
- Quick actions: Complete or No Answer
- Call links (tel:)

### 📈 KPI Board
- Team-wide performance table
- MC1 (morning slot) / MC2 (evening slot) metrics
- Screenshot tracking, prospect counts, sales calls
- Progress bars with color coding (red/orange/green)
- Date range filter

### 📊 Reports
- Visual analytics with Bar and Line charts (Chart.js)
- Team comparison chart with drill-down
- Call trends, connection rates, conversion funnels
- Date range filter with 15-second auto-refresh

### 🏢 Team Structure
- Org chart hierarchy with role-colored nodes
- Team table with per-member stats
- Per-member score progress bars

### 🏥 HR Desk
- Announcements board
- Leave management: request, approve, reject
- Employee celebrations: birthdays, work anniversaries
- Leave type filtering with approve/reject actions

### ⚙️ Settings
- KPI target configuration by role
- Integration URLs
- Scheduled sync settings

### 🔔 Notifications
- Bell icon with live unread count badge (polls every 30s)
- Notification panel: type icons (info/warning/success/danger/ping), mark as read, mark all read
- **Ping BDA**: Admin/TL can ping a BDA for low performance from the dashboard — creates a notification for that BDA

### 🎓 Tutorial Walkthrough
- Help icon opens a 13-slide interactive tutorial covering every page
- Slide navigation with Back/Next and dot indicators
- Works for all roles

### 🌙 Dark Mode
- Full dark mode toggle in profile modal
- Persists across sessions
- All components respect dark theme variables

### 📱 Responsive
- Fully responsive layout: desktop, tablet, and phone
- Adaptive grids, compact headers, horizontal-scrollable tables on mobile
- Touch-friendly: swipe tables, tap to copy, dropdown select

### 📋 Google Sheets Integration
- Master Sheet import with fuzzy column header matching
- BDA-level sheet push (assigned leads and prospects)
- Status sync back to master sheet
- Assignment column updates in master sheet

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Chart.js (react-chartjs-2), Lucide React |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL) with service_role client |
| Auth | JWT + Supabase Auth |
| Sheets | Google Sheets API (googleapis) |
| Styling | Custom CSS with CSS variables, dark mode |

## Database Schema

- **users** — employees with roles, team assignment, auth linkage
- **teams** — sales teams with master sheet URL
- **leads** — lead records with assignment tracking, WhatsApp, remarks
- **calling_sheet** — BDA calling sheets with per-row status
- **lead_assignments** — audit trail of lead assignments
- **kpi_records** — daily KPI snapshots per user (MC1/MC2)
- **prospects** — converted/sales prospects with payments
- **followups** — follow-up calendar entries
- **leaves** — leave requests and approvals
- **complaints** — BDA complaint submissions
- **notifications** — in-app notification feed

## Key Design Decisions

- Leads have `assignedInMaster` flag to track master sheet sync
- Calling status defaults to blank (`''`), BDAs must explicitly select after calling
- Only blanks are imported from BDA sheets (non-empty = already processed)
- 50-lead batch limit per BDA; excess stays "inactive" in leads table
- `table-layout: auto` on mobile for natural column sizing with horizontal scroll
- Date filtering uses `.in('date', dates[])` — Supabase `.gte()/.lte()` did not work on TEXT date columns

## Slack & Notifications

Customize integration URLs and sync schedules in Settings page. Supports automated end-of-day KPI push.

---

Built for sales operations teams needing a clear pipeline from lead import → distribution → calling → conversion → reporting.
