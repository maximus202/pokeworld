<script setup lang="ts">
const collection = useCollection()

// Re-read the collection when the screen opens. Without `lazy` the screen would wait for it; with
// it a first visit shows the skeleton. "Try again" on a card that failed to load re-runs it.
const { status, refresh } = await useAsyncData('collection-screen', async () => {
  await collection.refresh()
  return true
}, { lazy: true })
const loading = computed(() => status.value === 'pending')
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      My Collection
    </h1>

    <!-- A failed read must not look like an empty collection. Pokemon already loaded stay visible. -->
    <UAlert v-if="status === 'error'" color="error" variant="subtle" title="Couldn't load your collection" description="Your Pokemon are safe; something went wrong reading them. Try again." data-testid="collection-error">
      <template #actions>
        <UButton color="error" variant="outline" label="Try again" :loading="loading" data-testid="collection-retry" @click="refresh()" />
      </template>
    </UAlert>

    <div v-if="loading && !collection.items.value.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" data-testid="collection-loading">
      <USkeleton v-for="n in 6" :key="n" class="h-56" />
    </div>

    <div v-else-if="!collection.items.value.length && status !== 'error'" class="py-16 text-center" data-testid="collection-empty">
      <p class="text-lg font-semibold">
        You haven't caught any Pokemon yet
      </p>
      <p class="mb-4 text-muted">
        Open a Pokemon and press Catch to add it here.
      </p>
      <UButton to="/" label="Browse Pokemon" />
    </div>

    <div v-else-if="collection.items.value.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" data-testid="collection-list">
      <template v-for="item in collection.items.value" :key="item.name">
        <PokemonCard v-if="item.pokemon" :pokemon="item.pokemon" :caught-at="item.caughtAt" removable @remove="collection.removePokemon(item.name)" />
        <!-- It still counts and can be removed; it just could not be looked up. -->
        <div v-else class="space-y-2 rounded-xl border border-error p-3" :data-testid="`collection-error-${item.name}`">
          <p class="font-semibold">
            {{ displayName(item.name) }}
          </p>
          <p class="text-sm text-muted">
            Couldn't load this Pokemon.
          </p>
          <p class="text-xs text-muted" :title="formatCaughtDateTime(item.caughtAt)" data-allow-mismatch>
            {{ `Caught ${formatCaughtDate(item.caughtAt)}` }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton size="xs" color="error" variant="outline" label="Try again" :loading="loading" data-testid="retry-button" @click="refresh()" />
            <UButton size="xs" color="neutral" variant="outline" label="Remove" :aria-label="`Remove ${displayName(item.name)}`" data-testid="remove-button" @click="collection.removePokemon(item.name)" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
