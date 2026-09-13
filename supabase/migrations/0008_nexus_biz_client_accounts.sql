-- Client-managed trading accounts: accounts whose capital is not Luis's own.
--
-- Some nexus_biz_accounts are traded on behalf of someone else. The business
-- earns nothing from that account's own P&L -- it earns a commission on every
-- withdrawal the client makes. This adds a lightweight client record (no KYC:
-- that belongs to nexus_inv_clients, a different business line for IBKR
-- accounts) and a withdrawal log that captures the commission actually owed.
--
-- Same conventions as 0004/0005/0006: reached only through the service-role
-- key from server code, so RLS is enabled with no policies and the grant is
-- explicit (see 0003).

-- ── Clients ──────────────────────────────────────────────────────────────────

create table if not exists public.nexus_biz_clients (
  id          uuid primary key default gen_random_uuid(),
  full_name   text        not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Account ownership ────────────────────────────────────────────────────────
-- Null client_id means the account is Luis's own capital -- the default and
-- the case for every account today. withdrawal_commission_pct travels with
-- the account so it can change over time without touching past withdrawals,
-- which keep their own rate (see below).

alter table public.nexus_biz_accounts
  add column if not exists client_id uuid references public.nexus_biz_clients (id) on delete set null,
  add column if not exists withdrawal_commission_pct numeric(5, 2)
    check (withdrawal_commission_pct is null or (withdrawal_commission_pct >= 0 and withdrawal_commission_pct <= 100));

create index if not exists nexus_biz_accounts_client_idx
  on public.nexus_biz_accounts (client_id);

-- ── Client withdrawals ───────────────────────────────────────────────────────
-- One row per withdrawal a client makes from an account under management.
-- commission_pct and commission_amount are snapshotted at the moment of the
-- withdrawal: if the account's rate changes later, every past withdrawal
-- still shows what was actually owed at the time. commission_settled tracks
-- whether Luis has actually collected it, separately from the equity/expense
-- tables which only ever describe his own capital.

create table if not exists public.nexus_biz_client_withdrawals (
  id                  uuid primary key default gen_random_uuid(),
  account             text        not null references public.nexus_biz_accounts (account) on delete cascade,
  client_id           uuid        not null references public.nexus_biz_clients (id) on delete cascade,
  amount              numeric(14, 2) not null check (amount > 0),
  commission_pct      numeric(5, 2)  not null check (commission_pct >= 0 and commission_pct <= 100),
  commission_amount   numeric(14, 2) not null check (commission_amount >= 0),
  commission_settled  boolean     not null default false,
  withdrawn_on        date        not null,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists nexus_biz_client_withdrawals_account_idx
  on public.nexus_biz_client_withdrawals (account, withdrawn_on desc);

create index if not exists nexus_biz_client_withdrawals_client_idx
  on public.nexus_biz_client_withdrawals (client_id, withdrawn_on desc);

-- ── updated_at maintenance ───────────────────────────────────────────────────
-- Reuses the trigger function from 0001.

drop trigger if exists nexus_biz_clients_touch on public.nexus_biz_clients;
create trigger nexus_biz_clients_touch
  before update on public.nexus_biz_clients
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_biz_client_withdrawals_touch on public.nexus_biz_client_withdrawals;
create trigger nexus_biz_client_withdrawals_touch
  before update on public.nexus_biz_client_withdrawals
  for each row execute function public.nexus_touch_updated_at();

-- ── RLS: deny by default ─────────────────────────────────────────────────────

alter table public.nexus_biz_clients            enable row level security;
alter table public.nexus_biz_client_withdrawals enable row level security;

grant all privileges on table public.nexus_biz_clients            to service_role;
grant all privileges on table public.nexus_biz_client_withdrawals to service_role;
