import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../utils/admin'
import { runCatalogSync, reembedAll } from '../../utils/sync'

// Global catalog actions: sync (pull WooCommerce → Supabase) or reembed (force
// re-compute every vector from stored content).
export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const { action } = await readBody<{ action?: 'sync' | 'reembed' }>(event)
  const supabase = serverSupabaseServiceRole<any>(event)

  if (action === 'reembed') return await reembedAll(supabase)
  return await runCatalogSync(supabase)
})
