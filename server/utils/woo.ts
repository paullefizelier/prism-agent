// Thin WooCommerce REST API client. Server-only — credentials never reach the browser.
// Docs: https://woocommerce.github.io/woocommerce-rest-api-docs/#products
import { decode } from 'html-entities'

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
  // Replace tags with a space (not "") so words across block tags don't merge,
  // then decode HTML entities (&nbsp;, &amp;, &eacute;, &#8217;, …) and collapse whitespace.
  return decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
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
    attributes: Object.fromEntries(
      (p.attributes ?? []).map(a => [a.name, a.options])
    )
  }
}

export async function searchWooProducts(
  params: WooSearchParams
): Promise<BoardCard[]> {
  const config = useRuntimeConfig()
  if (!config.wooUrl || !config.wooKey || !config.wooSecret) {
    throw new Error(
      'WooCommerce credentials are not configured (NUXT_WOO_URL / NUXT_WOO_KEY / NUXT_WOO_SECRET)'
    )
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

// Fetch the ENTIRE published catalog (paginated). Used by the sync job.
export async function fetchAllWooProducts(): Promise<BoardCard[]> {
  const config = useRuntimeConfig()
  if (!config.wooUrl || !config.wooKey || !config.wooSecret) {
    throw new Error('WooCommerce credentials are not configured')
  }
  const auth = btoa(`${config.wooKey}:${config.wooSecret}`)
  const base = config.wooUrl.replace(/\/$/, '')
  const all: BoardCard[] = []

  // Loop pages until a short page signals the end (safety cap: 50 pages).
  for (let page = 1; page <= 50; page++) {
    const raw = await $fetch<WooProductRaw[]>(
      `${base}/wp-json/wc/v3/products?status=publish&per_page=100&page=${page}`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    all.push(...raw.map(toCard))
    if (raw.length < 100) break
  }
  return all
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

/** Real-time stock for a product, including per-variation (size) availability. */
export interface ProductAvailability {
  id: number
  name: string
  url: string
  type: string
  inStock: boolean
  stockQuantity: number | null
  variations: {
    id: number
    label: string
    inStock: boolean
    stockQuantity: number | null
  }[]
}

// Live availability check: the synced catalog can lag, so this hits WooCommerce
// directly. For variable products it also pulls each variation's stock.
export async function getWooAvailability(
  id: number
): Promise<ProductAvailability | null> {
  const config = useRuntimeConfig()
  if (!config.wooUrl || !config.wooKey || !config.wooSecret) {
    throw new Error('WooCommerce credentials are not configured')
  }
  const auth = btoa(`${config.wooKey}:${config.wooSecret}`)
  const base = config.wooUrl.replace(/\/$/, '')
  try {
    const p = await $fetch<
      WooProductRaw & { type: string, stock_quantity: number | null }
    >(`${base}/wp-json/wc/v3/products/${id}`, {
      headers: { Authorization: `Basic ${auth}` }
    })

    let variations: ProductAvailability['variations'] = []
    if (p.type === 'variable') {
      const raw = await $fetch<
        Array<{
          id: number
          attributes: { name: string, option: string }[]
          stock_status: string
          stock_quantity: number | null
        }>
      >(`${base}/wp-json/wc/v3/products/${id}/variations?per_page=100`, {
        headers: { Authorization: `Basic ${auth}` }
      })
      variations = raw.map(v => ({
        id: v.id,
        label: v.attributes.map(a => a.option).join(' · ') || `#${v.id}`,
        inStock: v.stock_status === 'instock',
        stockQuantity: v.stock_quantity ?? null
      }))
    }

    return {
      id: p.id,
      name: p.name,
      url: p.permalink,
      type: p.type,
      inStock: p.stock_status === 'instock',
      stockQuantity: p.stock_quantity ?? null,
      variations
    }
  } catch {
    return null
  }
}
