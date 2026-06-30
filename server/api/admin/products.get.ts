import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../utils/admin'

// Lists synced products with their embedding status (without shipping the huge
// vector — we only report whether one exists).
export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const supabase = serverSupabaseServiceRole<any>(event)

  const { data: meta, error } = await supabase
    .from('products')
    .select(
      'woo_id, name, categories, price, in_stock, on_sale, content_hash, updated_at'
    )
    .order('name')
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const { data: embedded } = await supabase
    .from('products')
    .select('woo_id')
    .not('embedding', 'is', null)
  const embeddedSet = new Set(
    ((embedded ?? []) as Array<{ woo_id: number }>).map(r => r.woo_id)
  )

  return ((meta ?? []) as Array<Record<string, unknown>>).map(p => ({
    woo_id: p.woo_id as number,
    name: p.name as string,
    categories: (p.categories as string[]) ?? [],
    price: p.price as string,
    in_stock: Boolean(p.in_stock),
    on_sale: Boolean(p.on_sale),
    embedded: embeddedSet.has(p.woo_id as number),
    updated_at: p.updated_at as string
  }))
})
