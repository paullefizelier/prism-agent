-- Ticketing status for leads: new (untouched) → in_progress → done.
-- Run via Supabase SQL editor, `supabase db push`, or the Supabase MCP.

alter table public.leads
  add column if not exists status text not null default 'new';

create index if not exists leads_status_idx on public.leads (status);
