import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../utils/admin'

// Paginated + searchable conversation list. Returns { items, total } so the
// admin can page through the full history instead of a silent 200-row cap.
export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(100, Math.max(1, Number(query.perPage) || 25))
  const search = typeof query.q === 'string' ? query.q.trim() : ''
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const supabase = serverSupabaseServiceRole<any>(event)
  let builder = supabase
    .from('conversations')
    .select(
      'id, created_at, updated_at, preview, product_context, recommended_woo_ids, message_count',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
  if (search) builder = builder.ilike('preview', `%${search}%`)

  const { data, error, count } = await builder.range(from, to)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { items: data ?? [], total: count ?? 0 }
})
