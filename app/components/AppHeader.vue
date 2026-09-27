<script setup lang="ts">
const collection = useCollection()
const route = useRoute()

const label = ref('')
onMounted(async () => {
  const [me] = await Promise.all([$fetch<{ label: string }>('/api/me'), collection.refresh()])
  label.value = me.label
})

const confirmOpen = ref(false)
const resetting = ref(false)

async function confirmReset() {
  resetting.value = true
  try {
    await collection.reset()
    confirmOpen.value = false
  } finally {
    resetting.value = false
  }
}

const links = computed(() => [
  { label: 'Pokemon', to: '/', active: route.path === '/' },
  { label: `My Collection (${collection.names.value.length})`, to: '/collection', active: route.path === '/collection' }
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
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
      <div class="ml-auto flex items-center gap-3">
        <span class="text-sm font-medium" data-testid="visitor-label">{{ label }}</span>
        <UButton
          color="secondary"
          size="sm"
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
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="outline" label="Cancel" data-testid="reset-cancel" @click="confirmOpen = false" />
          <UButton color="primary" label="Reset" :loading="resetting" data-testid="reset-confirm" @click="confirmReset" />
        </div>
      </template>
    </UModal>
  </header>
</template>
