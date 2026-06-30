import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const supabase = serverSupabaseServiceRole<any>(event)
  const { data, error } = await supabase
    .from('conversations')
    .select(
      'id, created_at, updated_at, preview, product_context, recommended_woo_ids, message_count'
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data ?? []
})
