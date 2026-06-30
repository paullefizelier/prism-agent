import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const supabase = serverSupabaseServiceRole<any>(event)
  const { data, error } = await supabase
    .from('custom_shape_requests')
    .select('id, created_at, name, email, phone, details, product_context, conversation_id')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data ?? []
})
