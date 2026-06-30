import { serverSupabaseServiceRole } from '#supabase/server'

// Public: delete a conversation, but only the one matching this visitor_id.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { visitorId } = getQuery(event)
  if (!id || typeof visitorId !== 'string' || !visitorId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id or visitorId' })
  }

  const supabase = serverSupabaseServiceRole<any>(event)
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('visitor_id', visitorId)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
