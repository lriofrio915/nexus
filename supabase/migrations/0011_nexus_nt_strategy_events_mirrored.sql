-- Tracks which strategy events the IBKR mirror bridge already acted on.
--
-- The bridge (Python service on the VPS, see ibkr-bridge/bridge in the
-- Administrator home folder -- not part of this repo, holds live IBKR
-- credentials) polls /api/trading/mirror-queue instead of Supabase directly,
-- so it never holds the service-role key. This column is what lets that
-- endpoint answer "what's left to mirror" and "mark this one done".

alter table public.nexus_nt_strategy_events
  add column if not exists mirrored_at timestamptz;

create index if not exists nexus_nt_strategy_events_unmirrored_idx
  on public.nexus_nt_strategy_events (occurred_at)
  where mirrored_at is null;
