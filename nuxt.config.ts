export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Pokeworld',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'description', content: 'Browse Pokemon and keep your own collection.' }]
    }
  },
  runtimeConfig: {
    // Override at runtime with NUXT_DB_PATH / NUXT_POKEAPI_BASE_URL.
    dbPath: process.env.DB_PATH || 'data/pokeworld.db',
    pokeapiBaseUrl: process.env.POKEAPI_BASE_URL || 'https://pokeapi.co/api/v2'
  }
})
