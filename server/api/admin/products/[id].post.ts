import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../../utils/admin'
import { syncProduct, reembedProduct } from '../../../utils/sync'

// Per-product actions: sync (refresh from WooCommerce) or reembed (recompute
// the vector from stored content).
export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isFinite(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid product id' })
  }
  const { action } = await readBody<{ action?: 'sync' | 'reembed' }>(event)
  const supabase = serverSupabaseServiceRole<any>(event)

  if (action === 'reembed') return await reembedProduct(supabase, id)
  return await syncProduct(supabase, id)
})
