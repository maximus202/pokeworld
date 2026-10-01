<script setup lang="ts">
useHead({
  titleTemplate: title => (title ? `${title} | Pokeworld` : 'Pokeworld'),
})

// Load the collection on the server so the header count is right on first
// paint.
await callOnce('collection', useCollection().refresh)
</script>

<template>
  <UApp>
    <a
      href="#main"
      class="
        sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2
        focus:z-50 focus:rounded focus:bg-default focus:px-3 focus:py-2
      "
    >
      Skip to content
    </a>

    <AppHeader />

    <main id="main">
      <UContainer class="py-6">
        <NuxtPage />
      </UContainer>
    </main>

    <PokemonPanel />
  </UApp>
</template>
