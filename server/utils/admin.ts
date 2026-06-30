import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'

// Gate admin endpoints: requires an authenticated Supabase user whose email is in
// the NUXT_ADMIN_EMAILS allowlist. Throws 401/403 otherwise.
export async function assertAdmin(event: H3Event): Promise<void> {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const email = (user.email ?? '').toLowerCase()
  const allow = useRuntimeConfig()
    .adminEmails.split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (!email || !allow.includes(email)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
}
