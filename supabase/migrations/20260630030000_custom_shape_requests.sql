-- Custom (made-to-order) board shape requests captured by the chat agent.
-- Run via Supabase SQL editor, `supabase db push`, or the Supabase MCP.

create table if not exists public.custom_shape_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  name            text not null,
  email           text not null,
  phone           text,
  details         text not null,             -- the rider's brief (dimensions, style, waves, budget…)
  product_context jsonb,                     -- board the visitor was viewing, if any
  conversation_id uuid                       -- links back to the conversation, if known
);

create index if not exists custom_shape_requests_created_at_idx
  on public.custom_shape_requests (created_at desc);

-- Server-only: RLS on, no policies. The service role (insert + admin API) bypasses
-- RLS; the admin API gatekeeps reads by checking the authenticated user's email.
alter table public.custom_shape_requests enable row level security;
