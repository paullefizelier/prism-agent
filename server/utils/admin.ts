import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'

// Gate admin endpoints: require an authenticated Supabase user.
// NOTE: every Supabase Auth user is treated as an admin here, so keep public
// signup DISABLED in Supabase (Authentication > Sign In / Providers) and create
// admin users manually. If you later add end-user accounts, reintroduce an
// allowlist or an app_metadata role check in this function.
export async function assertAdmin(event: H3Event): Promise<void> {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
}
