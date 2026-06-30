import { serverSupabaseServiceRole } from '#supabase/server'

// Public: full transcript of one conversation, but ONLY if it belongs to the
// requesting visitor (the visitor_id acts as an unguessable bearer token).
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { visitorId } = getQuery(event)
  if (!id || typeof visitorId !== 'string' || !visitorId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id or visitorId' })
  }

  const supabase = serverSupabaseServiceRole<any>(event)
  const { data, error } = await supabase
    .from('conversations')
    .select('id, messages, visitor_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  // 404 (not 403) when it isn't theirs, so existence isn't revealed.
  if (!data || data.visitor_id !== visitorId) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return { id: data.id, messages: data.messages ?? [] }
})
