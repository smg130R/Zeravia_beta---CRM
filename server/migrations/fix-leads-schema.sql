-- Fix the live Supabase DB schema so the leads import (and related features) work.
-- Run this once in Supabase Dashboard -> SQL Editor -> Run. It is idempotent.

-- Columns the import's addLeads() inserts/reads (missing on the live DB):
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "sheetRow" INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "month" TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS slot_amount BIGINT DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS amount_paid BIGINT DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS remaining BIGINT DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';

-- users.employeeCode exists as lowercase "employeecode" on the live DB but the
-- app queries "employeeCode". Fix the casing (only when it's not already correct):
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'employeecode')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'users' AND column_name = 'employeeCode') THEN
    ALTER TABLE users RENAME COLUMN employeecode TO "employeeCode";
  END IF;
END $$;

-- calling_sheet columns the app writes (whatsapp on every "Fetch 50 Leads"
-- insert, followUpDate/priority for follow-ups):
ALTER TABLE calling_sheet ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE calling_sheet ADD COLUMN IF NOT EXISTS "followUpDate" TEXT;
ALTER TABLE calling_sheet ADD COLUMN IF NOT EXISTS priority TEXT;