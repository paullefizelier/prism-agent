import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const supabase = serverSupabaseServiceRole<any>(event)

  const { data, error } = await supabase
    .from('conversations')
    .select('message_count, recommended_woo_ids')
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const rows = (data ?? []) as Array<{
    message_count: number
    recommended_woo_ids: number[] | null
  }>
  const totalConversations = rows.length
  const totalMessages = rows.reduce((s, r) => s + (r.message_count ?? 0), 0)

  // Most-recommended boards across all conversations.
  const counts = new Map<number, number>()
  for (const r of rows)
    for (const id of r.recommended_woo_ids ?? [])
      counts.set(id, (counts.get(id) ?? 0) + 1)
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const ids = top.map(([id]) => id)
  let names = new Map<number, string>()
  if (ids.length) {
    const { data: prods } = await supabase
      .from('products')
      .select('woo_id, name')
      .in('woo_id', ids)
    names = new Map(
      ((prods ?? []) as Array<{ woo_id: number, name: string }>).map(p => [
        p.woo_id,
        p.name
      ])
    )
  }
  const topBoards = top.map(([woo_id, count]) => ({
    woo_id,
    name: names.get(woo_id) ?? `#${woo_id}`,
    count
  }))

  // Open leads (status 'new'). Defensive: if the leads table isn't migrated
  // yet, count comes back null — fall back to 0 rather than failing the page.
  const { count: openLeads } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')

  return { totalConversations, totalMessages, topBoards, openLeads: openLeads ?? 0 }
})
