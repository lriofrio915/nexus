-- Per-strategy trading events, for the NT8 -> WhatsApp -> IBKR mirror.
--
-- nexus_nt_executions/positions/trades (0002) are account-level: NT8's
-- Account.ExecutionUpdate carries no strategy identity, so nothing in that
-- schema can say which bot placed a fill (see that migration's own
-- 0009 sibling for the equivalent limitation on the business side). This
-- table holds events reported directly BY each mirrored strategy instead
-- (NexusStrategyReporter.cs, called from inside the strategy's own
-- OnExecutionUpdate/OnOrderUpdate), so it is the only place that can filter
-- and act on "this account + this specific strategy".
--
-- Same conventions as 0002: reached only through the service-role key from
-- the ingest route, RLS enabled with no policies.

create table if not exists public.nexus_nt_strategy_events (
  id            text primary key,
  account       text        not null,
  strategy      text        not null,
  instrument    text        not null,
  event_type    text        not null check (event_type in ('opened', 'stop_moved', 'closed')),
  direction     text        not null check (direction in ('Long', 'Short')),
  quantity      integer     not null,
  price         numeric(20, 8),
  stop_price    numeric(20, 8),
  pnl_currency  numeric(20, 2),
  occurred_at   timestamptz not null,
  received_at   timestamptz not null default now()
);

create index if not exists nexus_nt_strategy_events_account_strategy_idx
  on public.nexus_nt_strategy_events (account, strategy, occurred_at desc);

alter table public.nexus_nt_strategy_events enable row level security;

grant all privileges on table public.nexus_nt_strategy_events to service_role;
