-- Conversation logging for the admin dashboard.
-- Run via Supabase SQL editor, `supabase db push`, or the Supabase MCP.

create table if not exists public.conversations (
  id                   uuid primary key,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  preview              text,                    -- first user message (truncated)
  product_context      jsonb,                   -- board the visitor was viewing, if any
  recommended_woo_ids  bigint[] default '{}',   -- boards surfaced by searchBoards
  message_count        int default 0,
  messages             jsonb not null default '[]'  -- full UIMessage[] transcript
);

create index if not exists conversations_created_at_idx
  on public.conversations (created_at desc);

-- Server-only: RLS on, no policies. The service role (logging + admin API) bypasses
-- RLS; the admin API gatekeeps reads by checking the authenticated user's email.
alter table public.conversations enable row level security;
