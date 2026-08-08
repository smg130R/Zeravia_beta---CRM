-- =====================================================
-- Bleep CRM — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- =====================================================

-- Drop existing tables (in dependency order) for fresh setup
DROP TABLE IF EXISTS lead_assignments CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS prospects CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS followups CASCADE;
DROP TABLE IF EXISTS calling_sheet CASCADE;
DROP TABLE IF EXISTS kpi_records CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','ops_head','hr','team_lead','bda')),
  phone TEXT,
  "teamId" TEXT,
  "joinedDate" TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD'),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','suspended')),
  "authId" UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  "assignedSheetUrl" TEXT,
  "prospectSheetTab" TEXT DEFAULT 'Sheet1',
  "prospectSheetUrl" TEXT,
  "assignedSheetTab" TEXT DEFAULT 'Sheet1',
  "employeeCode" TEXT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_team ON users("teamId");
CREATE INDEX idx_users_auth_id ON users("authId");

-- =====================================================
-- TEAMS
-- =====================================================
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "leadId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "masterSheetUrl" TEXT
);

-- =====================================================
-- KPI RECORDS
-- =====================================================
CREATE TABLE kpi_records (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  "mCalls" INTEGER DEFAULT 0,
  "mConn" INTEGER DEFAULT 0,
  "mSS" INTEGER DEFAULT 0,
  "mPros" INTEGER DEFAULT 0,
  "eCalls" INTEGER DEFAULT 0,
  "eConn" INTEGER DEFAULT 0,
  "eSS" INTEGER DEFAULT 0,
  "ePros" INTEGER DEFAULT 0,
  deals INTEGER DEFAULT 0,
  followups INTEGER DEFAULT 0,
  "perfScore" REAL DEFAULT 0.0,
  UNIQUE("userId", date)
);

CREATE INDEX idx_kpi_user_date ON kpi_records("userId", date);
CREATE INDEX idx_kpi_date ON kpi_records(date);

-- =====================================================
-- LEADS (from master Google Sheet)
-- =====================================================
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  contact TEXT NOT NULL,
  whatsapp TEXT DEFAULT '',
  "sheetRow" INTEGER,
  college TEXT,
  branch TEXT,
  year TEXT,
  status TEXT DEFAULT 'unassigned' CHECK (status IN ('unassigned','assigned','na','ni','form_shared','screenshot_shared','busy','switch_off','out_of_service','dropped')),
  "naCount" INTEGER DEFAULT 0,
  "assignedInMaster" BOOLEAN DEFAULT FALSE,
  "currentAssigneeId" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "createdAt" TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD'),
  "updatedAt" TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD')
);

CREATE INDEX idx_leads_team ON leads("teamId");
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assignee ON leads("currentAssigneeId");

-- =====================================================
-- LEAD ASSIGNMENTS HISTORY
-- =====================================================
CREATE TABLE lead_assignments (
  id SERIAL PRIMARY KEY,
  "leadId" INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  "assignedTo" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "assignedBy" INTEGER REFERENCES users(id) ON DELETE SET NULL,
  "assignedDate" TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD'),
  status TEXT,
  remarks TEXT
);

CREATE INDEX idx_assignments_lead ON lead_assignments("leadId");
CREATE INDEX idx_assignments_bda ON lead_assignments("assignedTo");

-- =====================================================
-- CALLING SHEET
-- =====================================================
CREATE TABLE calling_sheet (
  id SERIAL PRIMARY KEY,
  "assignedUserId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "leadId" INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  "customerName" TEXT NOT NULL,
  contact TEXT NOT NULL,
  college TEXT,
  branch TEXT,
  year TEXT,
  status TEXT DEFAULT 'Pending',
  "naCount" INTEGER DEFAULT 0,
  remarks TEXT DEFAULT '',
  "lastUpdated" TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD')
);

CREATE INDEX idx_calling_user ON calling_sheet("assignedUserId");
CREATE INDEX idx_calling_lead ON calling_sheet("leadId");

-- =====================================================
-- FOLLOWUPS
-- =====================================================
CREATE TABLE followups (
  id SERIAL PRIMARY KEY,
  "bdaId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "customerName" TEXT NOT NULL,
  contact TEXT NOT NULL,
  college TEXT,
  date TEXT NOT NULL,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Completed','Overdue')),
  remarks TEXT
);

CREATE INDEX idx_followups_bda ON followups("bdaId");
CREATE INDEX idx_followups_date ON followups(date);

-- =====================================================
-- LEAVES
-- =====================================================
CREATE TABLE leaves (
  id SERIAL PRIMARY KEY,
  "employeeId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "leaveType" TEXT NOT NULL CHECK ("leaveType" IN ('Casual','Medical','Earned')),
  "fromDate" TEXT NOT NULL,
  "toDate" TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected'))
);

CREATE INDEX idx_leaves_employee ON leaves("employeeId");
CREATE INDEX idx_leaves_status ON leaves(status);

-- =====================================================
-- COMPLAINTS
-- =====================================================
CREATE TABLE complaints (
  id SERIAL PRIMARY KEY,
  "bdaId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "bdaName" TEXT NOT NULL,
  "recipientRole" TEXT NOT NULL CHECK ("recipientRole" IN ('admin','hr','team_lead')),
  subject TEXT NOT NULL,
  details TEXT NOT NULL,
  "timestamp" TEXT DEFAULT to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Resolved'))
);

CREATE INDEX idx_complaints_status ON complaints(status);

-- =====================================================
-- PROSPECTS (BDA registrations / prospect logging)
-- =====================================================
CREATE TABLE prospects (
  id SERIAL PRIMARY KEY,
  "bdaId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "customerName" TEXT NOT NULL,
  contact TEXT NOT NULL,
  email TEXT DEFAULT '',
  college TEXT,
  branch TEXT,
  year TEXT,
  domain TEXT DEFAULT '',
  month TEXT DEFAULT '',
  experience TEXT DEFAULT '',
  state TEXT DEFAULT '',
  status TEXT DEFAULT 'Prospect' CHECK (status IN ('Prospect','Follow-up','NA','NI','Call Back','Registration Done','Converted','Lost')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','slot_booking','partial_paid','fully_paid','cancelled')),
  slot_amount NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  remaining NUMERIC DEFAULT 0,
  remarks TEXT DEFAULT '',
  "createdAt" TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD'),
  "updatedAt" TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD')
);

CREATE INDEX idx_prospects_bda ON prospects("bdaId");
CREATE INDEX idx_prospects_status ON prospects(status);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','success','danger','ping')),
  "isRead" BOOLEAN DEFAULT FALSE,
  "linkTo" TEXT,
  "createdAt" TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE INDEX idx_notifications_user ON notifications("userId");
CREATE INDEX idx_notifications_unread ON notifications("userId", "isRead") WHERE NOT "isRead";

-- =====================================================
-- SUPABASE AUTH TRIGGER
-- Auto-create public.users row when user signs up via Supabase Auth
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (name, email, role, phone, "teamId", status, "authId")
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'bda'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'teamId',
    'active',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calling_sheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- All tables: allow server (service_role) full access, block public
-- For a service-role setup, these are permissive to the authenticated
-- role used by the backend. Adjust as needed for anon keys.

CREATE POLICY "Service role full access users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access teams" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access kpi_records" ON kpi_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access leads" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access lead_assignments" ON lead_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access calling_sheet" ON calling_sheet FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access followups" ON followups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access leaves" ON leaves FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access prospects" ON prospects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access complaints" ON complaints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- Note: If you switch to anon key + JWT auth, replace the policies above
-- with row-level checks based on auth.uid() and the user's role.

-- No seed data — start with an empty platform.
-- Create your first admin via the API (after running the schema and trigger):
--   node scripts/create-admin.cjs
-- This uses supabase.auth.admin.createUser() which creates both the auth.users
-- record and (via the trigger) the public.users row.
