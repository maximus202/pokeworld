<script setup lang="ts">
const { items, refresh } = useCollection()
// Load the collection on the server so the header count is right on first paint.
await callOnce('collection', refresh)
</script>

<template>
  <UApp>
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-default focus:px-3 focus:py-2">
      Skip to content
    </a>
    <AppHeader />
    <main id="main">
      <UContainer class="py-6">
        <!-- Smoke page: the real screens replace this in the next phases. -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <PokemonCard v-for="item in items" :key="item.name" :pokemon="item.pokemon!" :caught-at="item.caughtAt" />
        </div>
      </UContainer>
    </main>
  </UApp>
</template>
