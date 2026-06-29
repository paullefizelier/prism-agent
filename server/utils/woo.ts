// Thin WooCommerce REST API client. Server-only — credentials never reach the browser.
// Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/#products

/** Raw product shape from the WooCommerce REST API (only the fields we use). */
interface WooProductRaw {
  id: number
  name: string
  permalink: string
  price: string
  regular_price: string
  sale_price: string
  on_sale: boolean
  stock_status: 'instock' | 'outofstock' | 'onbackorder'
  short_description: string
  categories: { id: number, name: string }[]
  images: { src: string, alt: string }[]
  attributes: { name: string, options: string[] }[]
}

/** Compact, model- and UI-friendly product card. */
export interface BoardCard {
  id: number
  name: string
  url: string
  price: string
  regularPrice: string
  onSale: boolean
  inStock: boolean
  summary: string
  image: string | null
  categories: string[]
  attributes: Record<string, string[]>
}

export interface WooSearchParams {
  search?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  perPage?: number
}

// Small in-memory cache to avoid hammering the WooCommerce API on repeated queries.
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number, data: BoardCard[] }>()

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function toCard(p: WooProductRaw): BoardCard {
  return {
    id: p.id,
    name: p.name,
    url: p.permalink,
    price: p.price,
    regularPrice: p.regular_price,
    onSale: p.on_sale,
    inStock: p.stock_status === 'instock',
    summary: stripHtml(p.short_description).slice(0, 280),
    image: p.images?.[0]?.src ?? null,
    categories: (p.categories ?? []).map(c => c.name),
    attributes: Object.fromEntries((p.attributes ?? []).map(a => [a.name, a.options]))
  }
}

export async function searchWooProducts(params: WooSearchParams): Promise<BoardCard[]> {
  const config = useRuntimeConfig()
  if (!config.wooUrl || !config.wooKey || !config.wooSecret) {
    throw new Error('WooCommerce credentials are not configured (NUXT_WOO_URL / NUXT_WOO_KEY / NUXT_WOO_SECRET)')
  }

  const key = JSON.stringify(params)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data

  const query = new URLSearchParams({
    status: 'publish',
    per_page: String(params.perPage ?? 6)
  })
  if (params.search) query.set('search', params.search)
  if (params.category) query.set('category', params.category)
  if (params.minPrice != null) query.set('min_price', String(params.minPrice))
  if (params.maxPrice != null) query.set('max_price', String(params.maxPrice))

  const auth = btoa(`${config.wooKey}:${config.wooSecret}`)
  const raw = await $fetch<WooProductRaw[]>(
    `${config.wooUrl.replace(/\/$/, '')}/wp-json/wc/v3/products?${query.toString()}`,
    { headers: { Authorization: `Basic ${auth}` } }
  )

  const cards = raw.map(toCard)
  cache.set(key, { at: Date.now(), data: cards })
  return cards
}

export async function getWooProduct(id: number): Promise<BoardCard | null> {
  const config = useRuntimeConfig()
  const auth = btoa(`${config.wooKey}:${config.wooSecret}`)
  try {
    const raw = await $fetch<WooProductRaw>(
      `${config.wooUrl.replace(/\/$/, '')}/wp-json/wc/v3/products/${id}`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    return toCard(raw)
  } catch {
    return null
  }
}
