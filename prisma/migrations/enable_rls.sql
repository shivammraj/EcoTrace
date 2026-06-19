-- ============================================================
-- Enable Row Level Security (RLS) on all public tables
-- This project uses Prisma (postgres role) for all DB access.
-- The postgres role has BYPASSRLS, so these policies do NOT
-- affect the app. They only block direct Supabase client access.
-- ============================================================

-- 1. Enable RLS on every table
ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_entries ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- emission_factors: public read-only reference data
-- Anyone may read; nobody (except postgres) may write.
-- ============================================================
CREATE POLICY "emission_factors_read_public"
  ON public.emission_factors
  FOR SELECT
  USING (true);

-- ============================================================
-- users, refresh_tokens, emission_entries:
-- No direct access via Supabase client allowed.
-- All writes go through the backend API (Prisma / postgres role).
-- Default-deny: no policies = no access for anon/authenticated.
-- ============================================================

-- If you later add Supabase Auth and want users to read their
-- own row, add a policy like:
--
-- CREATE POLICY "users_own_row"
--   ON public.users FOR SELECT
--   USING (auth.uid()::text = id::text);
