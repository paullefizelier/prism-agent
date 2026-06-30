// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@comark/nuxt', '@nuxt/image', '@nuxtjs/supabase', '@nuxtjs/i18n'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],
  ui: {
    colorMode: false
  },

  runtimeConfig: {
    // Server-only secrets (overridden at runtime by NUXT_* env vars). Never exposed to the client.
    googleApiKey: '', // NUXT_GOOGLE_API_KEY — Gemini API key (Google AI Studio)
    aiModel: 'gemini-3.5-flash', // NUXT_AI_MODEL — swap Gemini model here
    wooUrl: '', // NUXT_WOO_URL — e.g. https://www.prism-surfboards.com
    wooKey: '', // NUXT_WOO_KEY — WooCommerce consumer key
    wooSecret: '', // NUXT_WOO_SECRET — WooCommerce consumer secret
    cronSecret: '' // NUXT_CRON_SECRET — guards /api/sync (match Vercel's CRON_SECRET)
  },

  routeRules: {
    '/': { prerender: true },
    // The embeddable chat must be reachable in an <iframe> from the WooCommerce site.
    '/embed': {
      headers: {
        'Content-Security-Policy':
          'frame-ancestors \'self\' https://*.prism-surfboards.com https://prism-surfboards.com'
      }
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // Disable the module's auth redirect — this is a public widget, not a gated app.
  supabase: {
    redirect: false
  },

  // UI i18n. no_prefix: locale via browser detection + cookie, no URL change
  // (important for the iframe widget). Agent replies stay language-detected.
  i18n: {
    defaultLocale: 'fr',
    strategy: 'no_prefix',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale'
    }
  }
})