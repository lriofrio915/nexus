-- Trading run as a business: strategies, account mapping, costs, equity history.
--
-- The nexus_nt_* tables mirror what NinjaTrader reports. These add what the
-- platform cannot know: which bot runs on which account, what the business
-- spends to stay running, and the daily balance history behind the equity
-- curve.
--
-- Same conventions as the rest of the project: everything is reached through
-- the service-role key from server code, so RLS is enabled with no policies and
-- the grants are explicit -- default privileges do not reach service_role for
-- tables created from the SQL editor (see 0003).

-- ── Strategies ───────────────────────────────────────────────────────────────
-- The bots and portfolios being run. One strategy can cover several accounts.

create table if not exists public.nexus_biz_strategies (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null unique,
  kind        text        not null default 'bot' check (kind in ('bot', 'portfolio', 'manual')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Account mapping ──────────────────────────────────────────────────────────
-- `account` matches nexus_nt_accounts.name. Deliberately not a foreign key: a
-- mapping can be prepared before NinjaTrader has ever reported that account,
-- which is exactly what happens while a prop firm is under maintenance.

create table if not exists public.nexus_biz_accounts (
  account     text primary key,
  label       text,
  prop_firm   text,
  strategy_id uuid references public.nexus_biz_strategies (id) on delete set null,
  active      boolean     not null default true,
  started_on  date,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists nexus_biz_accounts_strategy_idx
  on public.nexus_biz_accounts (strategy_id);

-- ── Expenses ─────────────────────────────────────────────────────────────────
-- Both shapes of cost live here. A one_time charge lands on starts_on; a
-- recurring one repeats from starts_on until ends_on (or forever, when null).
-- The accrual itself is computed in lib/trading-metrics.ts rather than stored,
-- so editing a start date immediately corrects every past period.

create table if not exists public.nexus_biz_expenses (
  id          uuid primary key default gen_random_uuid(),
  concept     text        not null,
  category    text        not null default 'otros'
                check (category in ('infraestructura', 'cuentas', 'datos', 'software', 'otros')),
  amount      numeric(14, 2) not null check (amount >= 0),
  currency    text        not null default 'USD',
  kind        text        not null check (kind in ('one_time', 'recurring')),
  recurrence  text        check (recurrence in ('monthly', 'yearly')),
  starts_on   date        not null,
  ends_on     date,
  -- Attributes a cost to one account so profitability can be measured per
  -- account. Null means it belongs to the business as a whole, like the VPS.
  account     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- A recurring expense without a period cannot be accrued, and a one-time one
  -- with a period is a contradiction.
  constraint nexus_biz_expenses_recurrence_matches_kind check (
    (kind = 'recurring' and recurrence is not null) or
    (kind = 'one_time'  and recurrence is null)
  ),
  constraint nexus_biz_expenses_period_ordered check (
    ends_on is null or ends_on >= starts_on
  )
);

create index if not exists nexus_biz_expenses_starts_on_idx
  on public.nexus_biz_expenses (starts_on);

-- ── Daily equity ─────────────────────────────────────────────────────────────
-- Written once a day by the cron so the capital curve has a point even on days
-- without trades. Daily P&L is NOT stored here: it is derived from
-- nexus_nt_trades, which stays correct even if the cron misses a run.

create table if not exists public.nexus_biz_equity_daily (
  day          date        not null,
  account      text        not null,
  equity       numeric(20, 2),
  realized_pnl numeric(20, 2),
  recorded_at  timestamptz not null default now(),
  primary key (day, account)
);

create index if not exists nexus_biz_equity_daily_day_idx
  on public.nexus_biz_equity_daily (day desc);

-- ── updated_at maintenance ───────────────────────────────────────────────────
-- Reuses the trigger function from 0001.

drop trigger if exists nexus_biz_strategies_touch on public.nexus_biz_strategies;
create trigger nexus_biz_strategies_touch
  before update on public.nexus_biz_strategies
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_biz_accounts_touch on public.nexus_biz_accounts;
create trigger nexus_biz_accounts_touch
  before update on public.nexus_biz_accounts
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_biz_expenses_touch on public.nexus_biz_expenses;
create trigger nexus_biz_expenses_touch
  before update on public.nexus_biz_expenses
  for each row execute function public.nexus_touch_updated_at();

-- ── Seed ─────────────────────────────────────────────────────────────────────
-- The strategies being run and the costs incurred so far. Idempotent so the
-- migration can be replayed without duplicating anything.

insert into public.nexus_biz_strategies (name, kind, notes) values
  ('Dinkarus',                'bot',       'Opera en la cuenta Delta 1 de PJ Capital.'),
  ('INVERBOTS',               'bot',       'Opera en la cuenta Delta 2 de PJ Capital.'),
  ('Portafolio Cuantitativo', 'portfolio', 'Opera en la cuenta Flex de FundedNext.'),
  ('Full Margin',             'bot',       'Opera en la cuenta Rapid Daily de FundedNext.')
on conflict (name) do nothing;

insert into public.nexus_biz_expenses
  (concept, category, amount, kind, recurrence, starts_on, notes)
values
  ('VPS',                     'infraestructura',  20.00, 'recurring', 'monthly', date '2026-09-01',
   'Servidor donde corre NinjaTrader de forma continua.'),
  ('Pase directo Delta 1',    'cuentas',         200.00, 'one_time',   null,     date '2026-09-01',
   'PJ Capital. Pago unico, sin renovacion.'),
  ('Pase directo Delta 2',    'cuentas',         200.00, 'one_time',   null,     date '2026-09-01',
   'PJ Capital. Pago unico, sin renovacion.'),
  ('Prueba de fondeo Flex',   'cuentas',          70.00, 'one_time',   null,     date '2026-09-01',
   'FundedNext. Pago unico.'),
  ('Prueba de fondeo Rapid Daily', 'cuentas',     120.00, 'one_time',   null,     date '2026-09-01',
   'FundedNext. Pago unico.')
on conflict do nothing;

-- ── RLS: deny by default ─────────────────────────────────────────────────────

alter table public.nexus_biz_strategies    enable row level security;
alter table public.nexus_biz_accounts      enable row level security;
alter table public.nexus_biz_expenses      enable row level security;
alter table public.nexus_biz_equity_daily  enable row level security;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- Only service_role: the panel and the cron are the sole consumers, and anon
-- and authenticated stay denied by RLS having no policies.

grant all privileges on table public.nexus_biz_strategies   to service_role;
grant all privileges on table public.nexus_biz_accounts     to service_role;
grant all privileges on table public.nexus_biz_expenses     to service_role;
grant all privileges on table public.nexus_biz_equity_daily to service_role;
