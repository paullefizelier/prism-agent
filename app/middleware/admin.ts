// Require a logged-in Supabase user for /admin pages. The email allowlist is
// enforced server-side by the admin API (assertAdmin); this just gates the UI.
export default defineNuxtRouteMiddleware(() => {
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')
})
