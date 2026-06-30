import { serverSupabaseServiceRole } from '#supabase/server'

// Public: list a visitor's conversations (lightweight — no transcripts).
// Scoped by the anonymous visitor_id stored in the visitor's browser.
export default defineEventHandler(async (event) => {
  const { visitorId } = getQuery(event)
  if (typeof visitorId !== 'string' || !visitorId) return []

  const supabase = serverSupabaseServiceRole<any>(event)
  const { data, error } = await supabase
    .from('conversations')
    .select('id, preview, updated_at')
    .eq('visitor_id', visitorId)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return ((data ?? []) as Array<{ id: string, preview: string | null, updated_at: string }>).map(
    r => ({ id: r.id, title: r.preview || '', updatedAt: r.updated_at })
  )
})
