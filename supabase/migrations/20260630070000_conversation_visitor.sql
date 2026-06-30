-- Anonymous per-visitor grouping for conversations, so the chat widget can
-- re-serve a visitor's history from the backend (instead of localStorage).
-- The visitor_id is a random UUID stored in the visitor's browser.
-- Run via Supabase SQL editor, `supabase db push`, or the Supabase MCP.

alter table public.conversations
  add column if not exists visitor_id uuid;

create index if not exists conversations_visitor_id_idx
  on public.conversations (visitor_id, updated_at desc);
