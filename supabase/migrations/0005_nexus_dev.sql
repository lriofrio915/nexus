-- Software development run as a business: clients, projects, invoices, payments.
--
-- The trading side of the panel measures money the bots make. This measures the
-- other half of the business: the software built for clients, what was promised,
-- what was invoiced, and what has actually been collected.
--
-- Same conventions as 0004: everything is reached through the service-role key
-- from server code, so RLS is enabled with no policies and the grants are
-- explicit -- default privileges do not reach service_role for tables created
-- from the SQL editor (see 0003).

-- ── Clients ──────────────────────────────────────────────────────────────────

create table if not exists public.nexus_dev_clients (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  company     text,
  email       text,
  phone       text,
  location    text,
  notes       text,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists nexus_dev_clients_name_idx
  on public.nexus_dev_clients (lower(name));

-- ── Projects ─────────────────────────────────────────────────────────────────
-- `slug` is the panel route segment, so it is the stable public-ish handle for a
-- project even if the display name changes.
--
-- The maintenance columns describe the recurring plan sold with the project. They
-- are kept here rather than in a separate table because one project has at most
-- one plan; the day that stops being true they move out.

create table if not exists public.nexus_dev_projects (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.nexus_dev_clients (id) on delete cascade,
  name         text not null,
  slug         text not null unique,
  summary      text,
  -- Where the delivered work lives: the live site, the repository, and the
  -- client-facing invoice document when it was published outside this panel.
  site_url     text,
  repo_url     text,
  invoice_url  text,
  status       text not null default 'en_curso'
                 check (status in ('propuesta', 'en_curso', 'entregado', 'mantenimiento', 'pausado', 'cancelado')),
  hourly_rate  numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  started_on   date,
  delivered_on date,
  maintenance_amount    numeric(14, 2) check (maintenance_amount is null or maintenance_amount >= 0),
  maintenance_period    text check (maintenance_period in ('monthly', 'yearly')),
  maintenance_starts_on date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint nexus_dev_projects_delivery_ordered check (
    delivered_on is null or started_on is null or delivered_on >= started_on
  )
);

create index if not exists nexus_dev_projects_client_idx
  on public.nexus_dev_projects (client_id);

-- ── Deliverables ─────────────────────────────────────────────────────────────
-- The detail of what the project actually includes, one checkable line each.

create table if not exists public.nexus_dev_deliverables (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.nexus_dev_projects (id) on delete cascade,
  title      text not null,
  detail     text,
  done       boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nexus_dev_deliverables_project_idx
  on public.nexus_dev_deliverables (project_id, position);

-- ── Invoices ─────────────────────────────────────────────────────────────────
-- `status` is only the document's own state. Whether it is paid is NOT stored:
-- it is derived from the payments below, so a partial payment cannot drift out
-- of sync with a status column somebody forgot to update.

create table if not exists public.nexus_dev_invoices (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.nexus_dev_projects (id) on delete cascade,
  number     text not null unique,
  status     text not null default 'borrador'
               check (status in ('borrador', 'enviada', 'anulada')),
  currency   text not null default 'USD',
  issued_on  date not null,
  due_on     date,
  tax_rate   numeric(5, 2) not null default 0 check (tax_rate >= 0),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nexus_dev_invoices_due_ordered check (due_on is null or due_on >= issued_on)
);

create index if not exists nexus_dev_invoices_project_idx
  on public.nexus_dev_invoices (project_id);

-- ── Invoice lines ────────────────────────────────────────────────────────────
-- Amounts are never stored pre-multiplied: quantity x unit_price is computed in
-- lib/dev-metrics.ts, so correcting an hourly rate corrects every total.

create table if not exists public.nexus_dev_invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.nexus_dev_invoices (id) on delete cascade,
  description text not null,
  quantity    numeric(12, 2) not null default 1 check (quantity >= 0),
  unit        text not null default 'unidad' check (unit in ('h', 'unidad', 'mes', 'año')),
  unit_price  numeric(14, 2) not null check (unit_price >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists nexus_dev_invoice_items_invoice_idx
  on public.nexus_dev_invoice_items (invoice_id, position);

-- ── Payments ─────────────────────────────────────────────────────────────────
-- One row per abono. A full payment is simply one row for the whole balance, so
-- "paid", "partial" and "pending" are all the same shape of data.

create table if not exists public.nexus_dev_payments (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.nexus_dev_invoices (id) on delete cascade,
  amount     numeric(14, 2) not null check (amount > 0),
  paid_on    date not null,
  method     text not null default 'otro'
               check (method in ('transferencia', 'efectivo', 'zelle', 'paypal', 'cripto', 'otro')),
  reference  text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nexus_dev_payments_invoice_idx
  on public.nexus_dev_payments (invoice_id, paid_on);

-- ── updated_at maintenance ───────────────────────────────────────────────────
-- Reuses the trigger function from 0001.

drop trigger if exists nexus_dev_clients_touch on public.nexus_dev_clients;
create trigger nexus_dev_clients_touch
  before update on public.nexus_dev_clients
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_dev_projects_touch on public.nexus_dev_projects;
create trigger nexus_dev_projects_touch
  before update on public.nexus_dev_projects
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_dev_deliverables_touch on public.nexus_dev_deliverables;
create trigger nexus_dev_deliverables_touch
  before update on public.nexus_dev_deliverables
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_dev_invoices_touch on public.nexus_dev_invoices;
create trigger nexus_dev_invoices_touch
  before update on public.nexus_dev_invoices
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_dev_invoice_items_touch on public.nexus_dev_invoice_items;
create trigger nexus_dev_invoice_items_touch
  before update on public.nexus_dev_invoice_items
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_dev_payments_touch on public.nexus_dev_payments;
create trigger nexus_dev_payments_touch
  before update on public.nexus_dev_payments
  for each row execute function public.nexus_touch_updated_at();

-- ── Seed: first client ───────────────────────────────────────────────────────
-- Julio Rueda / HPF - High Protection Film LLC. The figures come from the cost
-- analysis done on 2026-09-05: 7.8 measured hours at 25 $/h plus the AI
-- generation passed through at cost, with the first maintenance year given as a
-- launch courtesy. Idempotent so the migration can be replayed.

insert into public.nexus_dev_clients (name, company, location, notes)
values (
  'Julio Rueda',
  'HPF - High Protection Film LLC',
  '15 Division Street, Danbury, Connecticut',
  'Taller de PPF, polarizado, ceramico, correccion de pintura, vinil y detailing.'
)
on conflict do nothing;

insert into public.nexus_dev_projects (
  client_id, name, slug, summary, site_url, repo_url, invoice_url,
  status, hourly_rate, started_on, delivered_on,
  maintenance_amount, maintenance_period, maintenance_starts_on, notes
)
select
  c.id,
  'Landing page HPF Protection',
  'julio-rueda-detailing',
  'Landing en ingles para el mercado de Estados Unidos: servicios, mision, galeria en video y formulario de solicitud de cita con contacto directo por WhatsApp.',
  'https://hpfprotection.com',
  'https://github.com/lriofrio915/julio-rueda-detailing',
  'https://claude.ai/code/artifact/e75a04cc-42ba-42fc-845c-6edd42bacc9f',
  'entregado',
  25.00,
  date '2026-08-14',
  date '2026-09-04',
  100.00,
  'yearly',
  date '2027-09-01',
  'Next.js 16 + Tailwind 4, desplegada en Vercel. Hosting sin costo al trafico actual.'
from public.nexus_dev_clients c
where c.name = 'Julio Rueda'
on conflict (slug) do nothing;

insert into public.nexus_dev_deliverables (project_id, title, detail, done, position)
select p.id, d.title, d.detail, true, d.position
from public.nexus_dev_projects p
cross join (values
  ('Landing page completa',        'Hero, servicios, mision, galeria y pie de pagina en una sola pagina.',            1),
  ('Formulario de solicitud de cita', 'Nombre, telefono, correo, vehiculo, servicio, fecha preferida y detalles.',    2),
  ('Contacto directo por WhatsApp',   'Boton flotante enlazado al numero del taller.',                                3),
  ('Video del hero',                  'Clip principal con alternativa estatica para reduced-motion.',                 4),
  ('Galeria en video',                'Cuatro clips H.264 optimizados para movil, 480x854 sin audio.',                5),
  ('Fotografia real integrada',       'Fotos del taller reemplazando los placeholders del diseno inicial.',           6),
  ('Iconografia Phosphor Duotone',    'Sustitucion de los iconos dibujados a mano por una libreria consistente.',     7),
  ('SEO y metadata',                  'Titulos, descripcion, Open Graph y datos del negocio en Danbury.',             8),
  ('Dominio hpfprotection.com',       'Dominio propio del cliente conectado al despliegue.',                          9),
  ('Despliegue en Vercel',            'Produccion verificada y repositorio privado en GitHub.',                      10)
) as d(title, detail, position)
where p.slug = 'julio-rueda-detailing'
  and not exists (
    select 1 from public.nexus_dev_deliverables x where x.project_id = p.id
  );

insert into public.nexus_dev_invoices (project_id, number, status, issued_on, notes)
select
  p.id,
  'HPF-2026-001',
  'enviada',
  date '2026-09-05',
  'Todo el proyecto se factura a una sola tarifa, 25 $/h, tanto el desarrollo como el mantenimiento. El primer ano de mantenimiento va sin cargo como cortesia de lanzamiento; la renovacion arranca en septiembre de 2027.'
from public.nexus_dev_projects p
where p.slug = 'julio-rueda-detailing'
on conflict (number) do nothing;

insert into public.nexus_dev_invoice_items (invoice_id, description, quantity, unit, unit_price, position)
select i.id, t.description, t.quantity, t.unit, t.unit_price, t.position
from public.nexus_dev_invoices i
cross join (values
  ('Desarrollo de la landing (horas medidas en sesion)', 7.80, 'h',      25.00, 1),
  ('Generacion con IA - 971.927 tokens, trasladados a costo', 1.00, 'unidad', 64.83, 2),
  ('Mantenimiento ano 1 - valor 100,00 $, cortesia de lanzamiento', 1.00, 'año', 0.00, 3)
) as t(description, quantity, unit, unit_price, position)
where i.number = 'HPF-2026-001'
  and not exists (
    select 1 from public.nexus_dev_invoice_items x where x.invoice_id = i.id
  );

-- ── RLS: deny by default ─────────────────────────────────────────────────────

alter table public.nexus_dev_clients       enable row level security;
alter table public.nexus_dev_projects      enable row level security;
alter table public.nexus_dev_deliverables  enable row level security;
alter table public.nexus_dev_invoices      enable row level security;
alter table public.nexus_dev_invoice_items enable row level security;
alter table public.nexus_dev_payments      enable row level security;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- Only service_role: the panel is the sole consumer, and anon and authenticated
-- stay denied by RLS having no policies.

grant all privileges on table public.nexus_dev_clients       to service_role;
grant all privileges on table public.nexus_dev_projects      to service_role;
grant all privileges on table public.nexus_dev_deliverables  to service_role;
grant all privileges on table public.nexus_dev_invoices      to service_role;
grant all privileges on table public.nexus_dev_invoice_items to service_role;
grant all privileges on table public.nexus_dev_payments      to service_role;
