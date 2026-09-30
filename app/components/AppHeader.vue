<script setup lang="ts">
const { count } = useCollection()

// The visitor cookie is httpOnly, so the label comes from the server (rendered
// on first load).
const { data: me } = await useFetch<{ label: string }>('/api/me', { key: 'me' })

const confirmOpen = ref(false)
</script>

<template>
  <header class="sticky top-0 z-40 bg-red-700 text-white shadow">
    <UContainer class="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
      <NuxtLink to="/" class="text-xl font-extrabold tracking-tight">
        Pokeworld
      </NuxtLink>

      <nav class="flex gap-1" aria-label="Main">
        <NuxtLink
          to="/"
          class="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/15"
          active-class="bg-white/20"
        >
          Pokemon
        </NuxtLink>
        <NuxtLink
          to="/collection"
          class="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/15"
          active-class="bg-white/20"
          data-testid="collection-link"
        >
          {{ `My Collection (${count})` }}
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-3">
        <span
          class="text-sm font-medium"
          data-testid="visitor-label"
          v-text="me?.label"
        />

        <UButton
          color="secondary"
          size="sm"
          class="text-neutral-900"
          label="Reset my collection"
          data-testid="reset-button"
          @click="confirmOpen = true"
        />
      </div>
    </UContainer>

    <ResetCollectionModal v-model:open="confirmOpen" />
  </header>
</template>
