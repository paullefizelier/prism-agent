import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../../utils/admin'

// Single lead + a light summary of its linked conversation (if any), for the
// dedicated lead detail page.
export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing lead id' })

  const supabase = serverSupabaseServiceRole<any>(event)
  const { data: lead, error } = await supabase
    .from('leads')
    .select(
      'id, created_at, reason, status, name, email, phone, message, product_context, conversation_id'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!lead) throw createError({ statusCode: 404, statusMessage: 'Lead not found' })

  let conversation = null
  if (lead.conversation_id) {
    const { data } = await supabase
      .from('conversations')
      .select('id, created_at, preview, message_count, recommended_woo_ids')
      .eq('id', lead.conversation_id)
      .maybeSingle()
    conversation = data ?? null
  }

  return { lead, conversation }
})
