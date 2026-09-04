-- Nexus agent schema.
--
-- Target project: liberty-trading-pro (ref njszztijddpsbcpfsufi).
-- Purely additive: every object is prefixed with nexus_ and nothing existing
-- is altered or dropped.
--
-- All access goes through the service-role key from server-side code, so RLS is
-- enabled with no permissive policies: anon and authenticated clients get
-- nothing, service_role bypasses RLS by design.

-- ── Conversations ────────────────────────────────────────────────────────────

create table if not exists public.nexus_conversations (
  id              uuid primary key,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  source          text        not null default 'web-chat',
  ip              text
);

create index if not exists nexus_conversations_last_message_at_idx
  on public.nexus_conversations (last_message_at desc nulls last);

-- ── Messages ─────────────────────────────────────────────────────────────────

create table if not exists public.nexus_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid        not null references public.nexus_conversations (id) on delete cascade,
  role            text        not null check (role in ('user', 'assistant', 'system', 'tool')),
  content         text        not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists nexus_messages_conversation_idx
  on public.nexus_messages (conversation_id, created_at);

-- ── Leads ────────────────────────────────────────────────────────────────────

create table if not exists public.nexus_leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  conversation_id uuid references public.nexus_conversations (id) on delete set null,
  nombre          text not null,
  telefono        text,
  email           text,
  negocio         text,
  necesidad       text,
  source          text not null default 'web-chat',
  -- A lead is useless without a way to reach the person.
  constraint nexus_leads_contact_present check (telefono is not null or email is not null)
);

create index if not exists nexus_leads_created_at_idx
  on public.nexus_leads (created_at desc);

-- ── Editable prompts ─────────────────────────────────────────────────────────

create table if not exists public.nexus_prompts (
  key        text primary key,
  content    text        not null,
  active     boolean     not null default true,
  updated_at timestamptz not null default now()
);

-- ── Editable site copy (reserved for the panel's content editor) ─────────────

create table if not exists public.nexus_content (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

-- ── updated_at maintenance ───────────────────────────────────────────────────

-- search_path is pinned empty so the function cannot resolve objects through a
-- caller-controlled schema order (Supabase linter 0011).
create or replace function public.nexus_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nexus_prompts_touch on public.nexus_prompts;
create trigger nexus_prompts_touch
  before update on public.nexus_prompts
  for each row execute function public.nexus_touch_updated_at();

drop trigger if exists nexus_content_touch on public.nexus_content;
create trigger nexus_content_touch
  before update on public.nexus_content
  for each row execute function public.nexus_touch_updated_at();

-- ── RLS: deny by default ─────────────────────────────────────────────────────

alter table public.nexus_conversations enable row level security;
alter table public.nexus_messages      enable row level security;
alter table public.nexus_leads         enable row level security;
alter table public.nexus_prompts       enable row level security;
alter table public.nexus_content       enable row level security;

-- Applied to liberty-trading-pro (njszztijddpsbcpfsufi) on 2026-09-05 as
-- migrations nexus_agent_schema + nexus_touch_updated_at_fix_search_path.
