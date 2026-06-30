import { serverSupabaseServiceRole } from '#supabase/server'
import { runCatalogSync } from '../utils/sync'

// Catalog sync endpoint. Triggered by Vercel Cron (see vercel.json), which sends
// `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set.
// Also callable manually with the same header for on-demand re-indexing.
export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig().cronSecret
  if (secret) {
    if (getHeader(event, 'authorization') !== `Bearer ${secret}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  const supabase = serverSupabaseServiceRole<any>(event)
  const result = await runCatalogSync(supabase)
  return { ok: true, ...result }
})
