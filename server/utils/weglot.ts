// Product content/URLs from the WooCommerce REST API are in the default language
// (French). Weglot translates the live site under a subdirectory scheme (e.g.
// /en/...). For non-default locales, prefix the product URL path so links open
// the Weglot-translated page. Idempotent and safe on malformed URLs.
const DEFAULT_LOCALE = 'fr'

export function localizeUrl(url: string, locale?: string): string {
  if (!url || !locale || locale === DEFAULT_LOCALE) return url
  try {
    const u = new URL(url)
    if (!u.pathname.startsWith(`/${locale}/`)) {
      u.pathname = `/${locale}${u.pathname}`
    }
    return u.toString()
  } catch {
    return url
  }
}
