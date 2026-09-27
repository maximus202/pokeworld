// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Overridable at runtime with NUXT_POKEAPI_BASE_URL / NUXT_DB_PATH.
    pokeapiBaseUrl: process.env.POKEAPI_BASE_URL || 'https://pokeapi.co/api/v2',
    dbPath: process.env.DB_PATH || 'data/pokeworld.db'
  },
  app: {
    head: {
      title: 'Pokeworld',
      htmlAttrs: { lang: 'en' }
    }
  }
})
