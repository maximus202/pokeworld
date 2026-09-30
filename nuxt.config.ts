export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  app: { head: { title: 'Pokeworld', htmlAttrs: { lang: 'en' } } },
  runtimeConfig: {
    dbPath: 'data/pokeworld.db', // NUXT_DB_PATH
    pokeapiBaseUrl: 'https://pokeapi.co/api/v2', // NUXT_POKEAPI_BASE_URL
    maxCollectionSize: 1000, // NUXT_MAX_COLLECTION_SIZE
  },
})
