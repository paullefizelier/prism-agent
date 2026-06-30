import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../../utils/admin'

const STATUSES = ['new', 'in_progress', 'done'] as const

// Update a lead's ticketing status.
export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing lead id' })

  const { status } = await readBody<{ status?: string }>(event)
  if (!status || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

  const supabase = serverSupabaseServiceRole<any>(event)
  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, status }
})
