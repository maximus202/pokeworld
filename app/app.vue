<script setup lang="ts">
// During SSR, useFetch calls the route through useRequestFetch(), which forwards the request's
// cookie header. That is what the spike test checks.
const { data: me } = await useFetch<{ label: string }>('/api/me', { key: 'me' })
</script>

<template>
  <UApp>
    <main class="p-6">
      <h1 class="text-2xl font-bold">Pokeworld</h1>
      <p data-testid="visitor-label">{{ me?.label }}</p>
    </main>
  </UApp>
</template>
