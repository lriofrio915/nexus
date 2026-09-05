-- Managed accounts run as a business: client KYC, documents, cash flows, holdings.
--
-- The third line of the business. The trading tables measure the bots' own
-- money and the dev tables measure software sold to clients; these measure
-- money belonging to other people, invested in shares through IBKR on their
-- behalf. Two jobs: collect everything IBKR asks for before an account can be
-- opened, and track what each client put in against what their holdings are
-- worth today.
--
-- Same conventions as 0004 and 0005: everything is reached through the
-- service-role key from server code, so RLS is enabled with no policies and the
-- grants are explicit -- default privileges do not reach service_role for
-- tables created from the SQL editor (see 0003).
--
-- This schema holds identity documents, income and net worth. It is the most
-- sensitive data in the project: nothing here is ever exposed to anon, and the
-- public onboarding form only ever inserts.

-- ── Clients ──────────────────────────────────────────────────────────────────
-- One table covers both the application and the client it becomes. Splitting
-- them would duplicate thirty KYC columns and force a copy on approval, so the
-- lifecycle lives in `status` instead and `source` records who filled it in.
--
-- Almost everything is nullable: the public form collects what it can and the
-- panel completes the rest before the IBKR application goes out.

create table if not exists public.nexus_inv_clients (
  id          uuid primary key default gen_random_uuid(),

  -- Identity
  full_name      text not null,
  email          text,
  phone          text,
  national_id    text,
  birth_date     date,
  nationality    text,
  marital_status text check (marital_status in ('soltero', 'casado', 'union_libre', 'divorciado', 'viudo')),
  dependents     integer check (dependents is null or dependents >= 0),

  -- Address
  address_line text,
  city         text,
  province     text,
  country      text not null default 'Ecuador',

  -- Employment and income
  employment_status text check (employment_status in ('empleado', 'independiente', 'empresario', 'jubilado', 'estudiante', 'desempleado')),
  occupation        text,
  employer          text,
  annual_income_usd numeric(14, 2) check (annual_income_usd is null or annual_income_usd >= 0),
  income_source     text,

  -- Net worth. `other_assets` is free text on purpose: clients describe land,
  -- vehicles and property in their own words, and forcing a taxonomy here would
  -- lose detail the IBKR application actually asks for.
  net_worth_usd     numeric(14, 2) check (net_worth_usd is null or net_worth_usd >= 0),
  liquid_assets_usd numeric(14, 2) check (liquid_assets_usd is null or liquid_assets_usd >= 0),
  other_assets      text,
  funds_source      text check (funds_source in ('salario', 'ahorros', 'negocio', 'herencia', 'venta_activos', 'otro')),

  -- Investment profile
  objective          text check (objective in ('jubilacion', 'crecimiento', 'ingresos', 'preservacion', 'especulacion')),
  risk_tolerance     text check (risk_tolerance in ('baja', 'media', 'alta')),
  horizon_years      integer check (horizon_years is null or horizon_years >= 0),
  experience_level   text check (experience_level in ('ninguna', 'basica', 'media', 'avanzada')),
  initial_deposit_usd numeric(14, 2) check (initial_deposit_usd is null or initial_deposit_usd >= 0),

  -- Compliance. `is_pep` is the politically exposed person question and
  -- `ibkr_related` covers employment at or affiliation with a broker-dealer;
  -- IBKR requires both and a blank answer is not acceptable, so they default to
  -- false rather than null.
  is_pep       boolean not null default false,
  ibkr_related boolean not null default false,
  tax_country  text,
  tax_id       text,

  -- Internal management
  status          text not null default 'solicitud'
                    check (status in ('solicitud', 'en_revision', 'documentos_pendientes', 'enviado_ibkr', 'aprobado', 'rechazado', 'activo')),
  source          text not null default 'panel' check (source in ('formulario', 'panel')),
  ibkr_account_id text,
  ibkr_opened_on  date,
  advisor_notes   text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The national id is the natural key for a person, but only once it is given:
-- a partial form submission legitimately has none, and a unique index treats
-- nulls as distinct, so duplicates are only blocked where it matters.
create unique index if not exists nexus_inv_clients_national_id_idx
  on public.nexus_inv_clients (national_id)
  where national_id is not null;

create index if not exists nexus_inv_clients_status_idx
  on public.nexus_inv_clients (status);

-- ── Documents ────────────────────────────────────────────────────────────────
-- Metadata only. The files live in the private `nexus-kyc` storage bucket and
-- are served to the panel through short-lived signed URLs, never publicly.

create table if not exists public.nexus_inv_documents (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.nexus_inv_clients (id) on delete cascade,
  kind          text not null default 'otro'
                  check (kind in ('cedula_frente', 'cedula_reverso', 'servicio_basico', 'comprobante_ingresos', 'otro')),
  storage_path  text not null unique,
  original_name text,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_at   timestamptz not null default now()
);

create index if not exists nexus_inv_documents_client_idx
  on public.nexus_inv_documents (client_id, uploaded_at desc);

-- ── Cash flows ───────────────────────────────────────────────────────────────
-- What the client moved in and out. `kind` carries the sign; amounts stay
-- positive so a wrong sign cannot silently invert a contribution.

create table if not exists public.nexus_inv_cash_flows (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.nexus_inv_clients (id) on delete cascade,
  kind        text not null check (kind in ('aporte', 'retiro', 'comision')),
  amount      numeric(14, 2) not null check (amount > 0),
  occurred_on date not null,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists nexus_inv_cash_flows_client_idx
  on public.nexus_inv_cash_flows (client_id, occurred_on);

-- ── Positions ────────────────────────────────────────────────────────────────
-- Holdings are loaded by hand for now; there is no IBKR feed yet. `last_price`
-- and `price_updated_on` travel together so the panel can say how stale a
-- valuation is instead of presenting a months-old price as current.
--
-- Market value, cost basis and P&L are never stored: they are derived in
-- lib/inv-metrics.ts, the same rule the trading and dev schemas follow.

create table if not exists public.nexus_inv_positions (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.nexus_inv_clients (id) on delete cascade,
  symbol           text not null,
  exchange         text,
  quantity         numeric(20, 8) not null check (quantity >= 0),
  avg_cost         numeric(20, 8) not null check (avg_cost >= 0),
  last_price       numeric(20, 8) check (last_price is null or last_price >= 0),
  price_updated_on date,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists nexus_inv_positions_client_symbol_idx
  on public.nexus_inv_positions (client_id, upper(symbol));

-- ── updated_at maintenance ───────────────────────────────────────────────────

drop trigger if exists nexus_inv_clients_touch on public.nexus_inv_clients;
create trigger nexus_inv_clients_touch
  before update on public.nexus_inv_clients
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_inv_cash_flows_touch on public.nexus_inv_cash_flows;
create trigger nexus_inv_cash_flows_touch
  before update on public.nexus_inv_cash_flows
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_inv_positions_touch on public.nexus_inv_positions;
create trigger nexus_inv_positions_touch
  before update on public.nexus_inv_positions
  for each row execute function public.nexus_touch_updated_at();

-- ── Storage: private KYC bucket ──────────────────────────────────────────────
-- No storage policies are created, so anon and authenticated cannot list, read
-- or write. The panel reaches the objects with the service-role key and hands
-- out signed URLs that expire in seconds.

insert into storage.buckets (id, name, public)
values ('nexus-kyc', 'nexus-kyc', false)
on conflict (id) do nothing;

-- ── Seed: first client ───────────────────────────────────────────────────────
-- Stefanny Medrano. Only what she actually provided is filled in; the rest stays
-- null until the onboarding form or the panel completes it. Idempotent so the
-- migration can be replayed.

insert into public.nexus_inv_clients (
  full_name, email, phone, national_id, marital_status, dependents,
  address_line, city, province, country,
  employment_status, occupation, other_assets,
  objective, status, source, advisor_notes
)
select
  'Stefanny Medrano',
  'tefybel@gmail.com',
  '+593982678350',
  '1600513616',
  'soltero',
  2,
  'Shell',
  'Shell',
  'Pastaza',
  'Ecuador',
  'empleado',
  'Medico',
  'Terrenos',
  'jubilacion',
  'en_revision',
  'panel',
  'Canton Mera. Faltan ingresos anuales, patrimonio, perfil de riesgo y documentos.'
where not exists (
  select 1 from public.nexus_inv_clients where national_id = '1600513616'
);

-- ── RLS: deny by default ─────────────────────────────────────────────────────

alter table public.nexus_inv_clients    enable row level security;
alter table public.nexus_inv_documents  enable row level security;
alter table public.nexus_inv_cash_flows enable row level security;
alter table public.nexus_inv_positions  enable row level security;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- Only service_role: the panel and the onboarding server action are the sole
-- consumers, and anon and authenticated stay denied by RLS having no policies.

grant all privileges on table public.nexus_inv_clients    to service_role;
grant all privileges on table public.nexus_inv_documents  to service_role;
grant all privileges on table public.nexus_inv_cash_flows to service_role;
grant all privileges on table public.nexus_inv_positions  to service_role;

-- Applied to liberty-trading-pro (njszztijddpsbcpfsufi) on 2026-09-06 via psql
-- against the direct connection, as migration nexus_inv_schema.
