import { serverSupabaseServiceRole } from '#supabase/server'
import { assertAdmin } from '../../../utils/admin'

export default defineEventHandler(async (event) => {
  await assertAdmin(event)
  const id = getRouterParam(event, 'id')
  const supabase = serverSupabaseServiceRole<any>(event)
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return data
})
