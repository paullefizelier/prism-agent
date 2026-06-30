-- IP rate limiting for the chat endpoint (anti-spam). Fixed-window counter,
-- incremented atomically. Run via Supabase SQL editor, `supabase db push`, or MCP.

create table if not exists public.rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

-- Atomically register a hit for `p_key` and return whether it's still within the
-- allowance. Resets the window once `p_window_seconds` have elapsed.
create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
as $$
declare
  v_count int;
begin
  insert into public.rate_limits (key, count, window_start)
    values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then 1
          else public.rate_limits.count + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
          then now()
          else public.rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Server-only (service role). Never callable by anon/authenticated.
revoke execute on function public.check_rate_limit(text, int, int) from anon, authenticated;
