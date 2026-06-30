-- Leads / contact-handoff requests captured by the chat agent: callbacks,
-- after-sales, quotes/pro orders, custom shapes, etc.
-- Run via Supabase SQL editor, `supabase db push`, or the Supabase MCP.

-- Supersedes the earlier custom_shape_requests table (custom shapes are now a
-- lead with reason = 'custom_shape').
drop table if exists public.custom_shape_requests cascade;

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  reason          text not null,             -- callback | sav | quote | custom_shape | other
  name            text not null,
  email           text not null,
  phone           text,
  message         text not null,             -- the request details / brief
  product_context jsonb,                     -- page the visitor was on, if any
  conversation_id uuid                       -- links back to the conversation, if known
);

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

-- Server-only: RLS on, no policies. The service role (insert + admin API) bypasses
-- RLS; the admin API gatekeeps reads by checking the authenticated user's email.
alter table public.leads enable row level security;
