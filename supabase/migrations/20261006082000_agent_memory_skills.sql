-- Server-only durable context used by the arts-agent-api Edge Function.
-- Client roles have no policies and explicit table grants are revoked; RLS remains enabled.
create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global',
  kind text not null default 'fact',
  key text not null,
  value jsonb not null,
  source text,
  importance integer not null default 50 check (importance between 0 and 100),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scope, key)
);

alter table public.agent_memory enable row level security;
revoke all on table public.agent_memory from anon, authenticated;
grant select, insert, update on table public.agent_memory to service_role;

create index if not exists agent_memory_scope_importance_idx
  on public.agent_memory(scope, importance desc, updated_at desc);
create index if not exists agent_memory_expires_idx
  on public.agent_memory(expires_at) where expires_at is not null;

create table if not exists public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  instructions text not null,
  enabled boolean not null default true,
  priority integer not null default 50 check (priority between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_skills enable row level security;
revoke all on table public.agent_skills from anon, authenticated;
grant select on table public.agent_skills to service_role;

create index if not exists agent_skills_enabled_priority_idx
  on public.agent_skills(enabled, priority desc);
