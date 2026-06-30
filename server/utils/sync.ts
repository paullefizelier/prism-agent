// Catalog → Supabase sync. Refreshes product metadata every run, and re-embeds
// only products whose content changed (saves embedding cost).
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllWooProducts, getWooProduct, type BoardCard } from './woo'
import { embedDocuments } from './embeddings'

// The text we embed for semantic matching: name + description + categories + specs.
function contentForEmbedding(b: BoardCard): string {
  const attrs = Object.entries(b.attributes)
    .map(([k, v]) => `${k}: ${v.join(', ')}`)
    .join('. ')
  return [
    b.name,
    b.summary,
    b.categories.length ? `Catégories: ${b.categories.join(', ')}` : '',
    attrs
  ]
    .filter(Boolean)
    .join('. ')
}

// Lightweight FNV-1a hash — only used to detect content changes (skip re-embed).
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export interface SyncResult {
  total: number
  embedded: number
}

export async function runCatalogSync(
  supabase: SupabaseClient
): Promise<SyncResult> {
  const products = await fetchAllWooProducts()
  const items = products.map((b) => {
    const content = contentForEmbedding(b)
    return { b, content, contentHash: hash(content) }
  })

  // Products that already have an embedding (only these count as "indexed").
  // The content_hash is written together with the embedding (step 2), so a row
  // with a hash AND an embedding is up to date; everything else gets embedded.
  const { data: existing } = await supabase
    .from('products')
    .select('woo_id, content_hash')
    .not('embedding', 'is', null)
  const indexedHash = new Map<number, string | null>(
    (existing ?? []).map(
      (r: { woo_id: number, content_hash: string | null }) => [
        r.woo_id,
        r.content_hash
      ]
    )
  )

  // 1) Refresh metadata for everything (no embedding/hash here → vectors preserved).
  const metaRows = items.map(({ b, content }) => ({
    woo_id: b.id,
    name: b.name,
    url: b.url,
    price: b.price,
    regular_price: b.regularPrice,
    on_sale: b.onSale,
    in_stock: b.inStock,
    summary: b.summary,
    image: b.image,
    categories: b.categories,
    attributes: b.attributes,
    content,
    updated_at: new Date().toISOString()
  }))
  const { error: upsertErr } = await supabase
    .from('products')
    .upsert(metaRows, { onConflict: 'woo_id' })
  if (upsertErr) throw new Error(`Metadata upsert failed: ${upsertErr.message}`)

  // 2) Embed new/changed products, then write vector + hash together.
  const changed = items.filter(
    ({ b, contentHash }) => indexedHash.get(b.id) !== contentHash
  )
  if (changed.length) {
    const vectors = await embedDocuments(changed.map(c => c.content))
    const embRows = changed.map((c, i) => ({
      woo_id: c.b.id,
      // name/url are NOT NULL: include them so the upsert's INSERT candidate is
      // valid (they're identical to the metadata row, so the UPDATE path is a no-op).
      name: c.b.name,
      url: c.b.url,
      embedding: JSON.stringify(vectors[i]), // pgvector accepts the "[...]" literal
      content_hash: c.contentHash
    }))
    const { error: embErr } = await supabase
      .from('products')
      .upsert(embRows, { onConflict: 'woo_id' })
    if (embErr) throw new Error(`Embedding upsert failed: ${embErr.message}`)
  }

  return { total: products.length, embedded: changed.length }
}

// Metadata columns for one product (mirrors runCatalogSync's metaRows).
function metaRow(b: BoardCard, content: string) {
  return {
    woo_id: b.id,
    name: b.name,
    url: b.url,
    price: b.price,
    regular_price: b.regularPrice,
    on_sale: b.onSale,
    in_stock: b.inStock,
    summary: b.summary,
    image: b.image,
    categories: b.categories,
    attributes: b.attributes,
    content,
    updated_at: new Date().toISOString()
  }
}

// Sync ONE product from WooCommerce → Supabase (refresh metadata, re-embed if its
// content changed). Used by the admin per-product "resync" action.
export async function syncProduct(
  supabase: SupabaseClient,
  wooId: number
): Promise<{ found: boolean, embedded: boolean }> {
  const b = await getWooProduct(wooId)
  if (!b) return { found: false, embedded: false }

  const content = contentForEmbedding(b)
  const contentHash = hash(content)

  const { data: existing } = await supabase
    .from('products')
    .select('content_hash, embedding')
    .eq('woo_id', wooId)
    .maybeSingle()
  const upToDate = existing?.embedding != null && existing.content_hash === contentHash

  const { error: upsertErr } = await supabase
    .from('products')
    .upsert(metaRow(b, content), { onConflict: 'woo_id' })
  if (upsertErr) throw new Error(`Metadata upsert failed: ${upsertErr.message}`)

  if (!upToDate) {
    const [vector] = await embedDocuments([content])
    const { error: embErr } = await supabase
      .from('products')
      .upsert(
        {
          woo_id: b.id,
          name: b.name,
          url: b.url,
          embedding: JSON.stringify(vector),
          content_hash: contentHash
        },
        { onConflict: 'woo_id' }
      )
    if (embErr) throw new Error(`Embedding upsert failed: ${embErr.message}`)
  }

  return { found: true, embedded: !upToDate }
}

// Force re-embed ONE product from its already-stored content (no Woo fetch).
export async function reembedProduct(
  supabase: SupabaseClient,
  wooId: number
): Promise<{ found: boolean }> {
  const { data } = await supabase
    .from('products')
    .select('woo_id, name, url, content')
    .eq('woo_id', wooId)
    .maybeSingle()
  if (!data?.content) return { found: false }

  const [vector] = await embedDocuments([data.content])
  const { error } = await supabase
    .from('products')
    .upsert(
      {
        woo_id: data.woo_id,
        name: data.name,
        url: data.url,
        embedding: JSON.stringify(vector),
        content_hash: hash(data.content)
      },
      { onConflict: 'woo_id' }
    )
  if (error) throw new Error(`Embedding upsert failed: ${error.message}`)
  return { found: true }
}

// Force re-embed ALL products from their stored content (no Woo fetch). Useful
// after changing the embedding model or the content format.
export async function reembedAll(
  supabase: SupabaseClient
): Promise<{ count: number }> {
  const { data, error } = await supabase
    .from('products')
    .select('woo_id, name, url, content')
  if (error) throw new Error(`Read failed: ${error.message}`)

  const rows = ((data ?? []) as Array<{
    woo_id: number
    name: string
    url: string
    content: string | null
  }>).filter(r => r.content)
  if (!rows.length) return { count: 0 }

  const vectors = await embedDocuments(rows.map(r => r.content as string))
  const embRows = rows.map((r, i) => ({
    woo_id: r.woo_id,
    name: r.name,
    url: r.url,
    embedding: JSON.stringify(vectors[i]),
    content_hash: hash(r.content as string)
  }))
  const { error: embErr } = await supabase
    .from('products')
    .upsert(embRows, { onConflict: 'woo_id' })
  if (embErr) throw new Error(`Embedding upsert failed: ${embErr.message}`)
  return { count: embRows.length }
}
