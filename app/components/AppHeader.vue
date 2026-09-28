<script setup lang="ts">
const collection = useCollection()
const route = useRoute()
const requestFetch = useRequestFetch()

// The visitor cookie is httpOnly, so the label comes from the server (rendered on first load).
const { data: me } = await useAsyncData('me', () => requestFetch<{ label: string }>('/api/me'))

const confirmOpen = ref(false)
const resetting = ref(false)
const resetError = ref('')

watch(confirmOpen, (open) => {
  if (open) resetError.value = ''
})

async function confirmReset() {
  resetting.value = true
  resetError.value = ''
  try {
    await collection.reset()
    confirmOpen.value = false
  } catch {
    resetError.value = 'Couldn\'t reset your collection. Nothing was changed. Please try again.'
  } finally {
    resetting.value = false
  }
}

const links = computed(() => [
  { label: 'Pokemon', to: '/', active: route.path === '/' },
  { label: `My Collection (${collection.count.value})`, to: '/collection', active: route.path === '/collection' }
])
</script>

<template>
  <header class="sticky top-0 z-40 bg-primary text-white shadow">
    <UContainer class="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
      <NuxtLink to="/" class="text-xl font-extrabold tracking-tight">
        Pokeworld
      </NuxtLink>
      <nav class="flex gap-1" aria-label="Main">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/15"
          :class="link.active && 'bg-white/20'"
          :aria-current="link.active ? 'page' : undefined"
          data-testid="nav-link"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
      <div class="ml-auto flex items-center gap-3">
        <span class="text-sm font-medium" data-testid="visitor-label">{{ me?.label }}</span>
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

    <UModal
      v-model:open="confirmOpen"
      title="Reset your collection?"
      description="This removes every Pokemon you've caught. It can't be undone."
    >
      <template #body>
        <UAlert
          v-if="resetError"
          color="error"
          variant="subtle"
          :description="resetError"
          data-testid="reset-error"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" data-testid="reset-cancel" @click="confirmOpen = false" />
          <UButton color="primary" label="Reset" :loading="resetting" data-testid="reset-confirm" @click="confirmReset" />
        </div>
      </template>
    </UModal>
  </header>
</template>
