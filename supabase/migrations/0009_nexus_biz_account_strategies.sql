-- Accounts can run more than one strategy.
--
-- Stéfanny Medrano's FundedNext account runs both "Portafolio Cuantitativo"
-- and "Inverbots" at once, which a single nexus_biz_accounts.strategy_id
-- column cannot express. This replaces it with a join table: an account maps
-- to zero, one, or several strategies.
--
-- NinjaTrader reports account-level results only -- individual trades carry
-- no bot/strategy tag -- so an account's full result is attributed to every
-- strategy it runs, not split between them. A strategy total is therefore
-- "what this strategy's accounts made", which double-counts shared accounts
-- by design; lib/trading-metrics.ts documents this at the call site.
--
-- Same conventions as 0004+: reached only through the service-role key, RLS
-- enabled with no policies, explicit grant (see 0003).

create table if not exists public.nexus_biz_account_strategies (
  account      text        not null references public.nexus_biz_accounts (account) on delete cascade,
  strategy_id  uuid        not null references public.nexus_biz_strategies (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (account, strategy_id)
);

create index if not exists nexus_biz_account_strategies_strategy_idx
  on public.nexus_biz_account_strategies (strategy_id);

-- Carry forward every existing single-strategy assignment.
insert into public.nexus_biz_account_strategies (account, strategy_id)
select account, strategy_id
from public.nexus_biz_accounts
where strategy_id is not null
on conflict (account, strategy_id) do nothing;

alter table public.nexus_biz_accounts
  drop column if exists strategy_id;

drop index if exists nexus_biz_accounts_strategy_idx;

-- ── RLS: deny by default ─────────────────────────────────────────────────────

alter table public.nexus_biz_account_strategies enable row level security;

grant all privileges on table public.nexus_biz_account_strategies to service_role;

-- ── Naming cleanup ───────────────────────────────────────────────────────────
-- Every other strategy name is already title case; this one was typed as an
-- all-caps brand name and stands out in every table that lists strategies
-- next to it.

update public.nexus_biz_strategies set name = 'Inverbots' where name = 'INVERBOTS';
