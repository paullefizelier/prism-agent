import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../utils/admin'

export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const supabase = serverSupabaseServiceRole<any>(event)

  const { data, error } = await supabase
    .from('conversations')
    .select('created_at, message_count, recommended_woo_ids')
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const rows = (data ?? []) as Array<{
    created_at: string
    message_count: number
    recommended_woo_ids: number[] | null
  }>
  const totalConversations = rows.length
  const totalMessages = rows.reduce((s, r) => s + (r.message_count ?? 0), 0)
  const withReco = rows.filter(r => (r.recommended_woo_ids?.length ?? 0) > 0).length
  const avgMessages = totalConversations
    ? Math.round((totalMessages / totalConversations) * 10) / 10
    : 0

  // 14-day conversation time series (oldest → newest).
  const days: { date: string, count: number }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]))
  for (const r of rows) {
    const idx = dayIndex.get((r.created_at ?? '').slice(0, 10))
    if (idx != null) days[idx]!.count++
  }

  // Most-recommended boards across all conversations.
  const counts = new Map<number, number>()
  for (const r of rows)
    for (const id of r.recommended_woo_ids ?? [])
      counts.set(id, (counts.get(id) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const ids = top.map(([id]) => id)
  let names = new Map<number, string>()
  if (ids.length) {
    const { data: prods } = await supabase
      .from('products')
      .select('woo_id, name')
      .in('woo_id', ids)
    names = new Map(
      ((prods ?? []) as Array<{ woo_id: number, name: string }>).map(p => [p.woo_id, p.name])
    )
  }
  const topBoards = top.map(([woo_id, count]) => ({
    woo_id,
    name: names.get(woo_id) ?? `#${woo_id}`,
    count
  }))

  // Leads breakdowns. Defensive: if the leads table isn't migrated yet, the
  // query errors and we just report zeros rather than failing the dashboard.
  const leadsByReason: Record<string, number> = {}
  const leadsByStatus: Record<string, number> = {}
  let totalLeads = 0
  const { data: leadRows } = await supabase.from('leads').select('reason, status')
  for (const l of (leadRows ?? []) as Array<{ reason: string, status: string }>) {
    totalLeads++
    leadsByReason[l.reason] = (leadsByReason[l.reason] ?? 0) + 1
    leadsByStatus[l.status] = (leadsByStatus[l.status] ?? 0) + 1
  }
  const openLeads = leadsByStatus.new ?? 0
  // Conversion rate as a percentage (1 decimal).
  const conversionRate = totalConversations
    ? Math.round((totalLeads / totalConversations) * 1000) / 10
    : 0

  return {
    totalConversations,
    totalMessages,
    avgMessages,
    withReco,
    openLeads,
    totalLeads,
    conversionRate,
    topBoards,
    leadsByReason,
    leadsByStatus,
    conversationsByDay: days
  }
})
