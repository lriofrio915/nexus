-- Grants for the nexus_nt_* tables.
--
-- 0002 was run from the SQL editor, where the tables end up owned by a role
-- whose default privileges do not reach service_role. PostgREST authenticates
-- as service_role, so every read and write returned 42501 "permission denied"
-- even though the tables existed and RLS is bypassed for that role.
--
-- Only service_role is granted: the panel and the ingest route are the sole
-- consumers, and RLS already denies anon and authenticated by policy absence.

grant all privileges on table public.nexus_nt_accounts   to service_role;
grant all privileges on table public.nexus_nt_executions to service_role;
grant all privileges on table public.nexus_nt_positions  to service_role;
grant all privileges on table public.nexus_nt_trades     to service_role;
