-- Prism catalog: vectorized product table for semantic search.
-- Run via Supabase SQL editor, `supabase db push`, or the Supabase MCP.

create extension if not exists vector;

create table if not exists public.products (
  woo_id        bigint primary key,
  name          text not null,
  url           text not null,
  price         text,
  regular_price text,
  on_sale       boolean default false,
  in_stock      boolean default true,
  summary       text,
  image         text,
  categories    text[] default '{}',
  attributes    jsonb  default '{}',
  content       text,           -- the text that was embedded
  content_hash  text,           -- skip re-embedding unchanged products
  embedding     vector(1536),   -- gemini-embedding-2, outputDimensionality 1536
  updated_at    timestamptz default now()
);

-- Cosine HNSW index for fast semantic search.
create index if not exists products_embedding_idx
  on public.products using hnsw (embedding vector_cosine_ops);

-- Server-only table: enable RLS with no policies. The service-role key (used by
-- the sync job and the search tool) bypasses RLS; anon/authenticated get nothing.
alter table public.products enable row level security;

-- Semantic search. SECURITY INVOKER (default): an anon caller would hit RLS and
-- get zero rows. We only ever call it with the service role. Revoke anyway.
create or replace function public.match_products(
  query_embedding vector(1536),
  match_count int default 6,
  only_in_stock boolean default true
)
returns table (
  woo_id bigint,
  name text,
  url text,
  price text,
  regular_price text,
  on_sale boolean,
  in_stock boolean,
  summary text,
  image text,
  categories text[],
  similarity float
)
language sql stable
as $$
  select
    p.woo_id, p.name, p.url, p.price, p.regular_price, p.on_sale,
    p.in_stock, p.summary, p.image, p.categories,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.products p
  where p.embedding is not null
    and (not only_in_stock or p.in_stock)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_products(vector, int, boolean) from anon, authenticated;
