<script setup lang="ts">
const collection = useCollection()
const retrying = ref(false)

async function retry() {
  retrying.value = true
  try {
    await collection.refresh()
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      My Collection
    </h1>

    <UAlert
      v-if="collection.failed.value"
      color="error"
      variant="subtle"
      title="Couldn't load your collection"
      description="Something went wrong. Your Pokemon are safe; try again."
      data-testid="collection-error"
    >
      <template #actions>
        <UButton color="error" variant="outline" label="Try again" :loading="retrying" data-testid="collection-retry" @click="retry" />
      </template>
    </UAlert>

    <div
      v-else-if="!collection.loaded.value"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      data-testid="collection-loading"
    >
      <USkeleton v-for="n in 6" :key="n" class="h-56" />
    </div>

    <div v-else-if="!collection.items.value.length" class="py-16 text-center" data-testid="collection-empty">
      <p class="text-lg font-semibold">
        You haven't caught any Pokemon yet
      </p>
      <p class="mb-4 text-muted">
        Open a Pokemon and press Catch to add it here.
      </p>
      <UButton to="/" label="Browse Pokemon" />
    </div>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" data-testid="collection-list">
      <template v-for="item in collection.items.value" :key="item.name">
        <PokemonCard
          v-if="item.pokemon"
          :pokemon="item.pokemon"
          :caught-at="item.caughtAt"
          removable
          @remove="collection.removePokemon(item.name)"
        />
        <PokemonErrorCard
          v-else
          :name="item.name"
          :caught-at="item.caughtAt"
          @retry="collection.refresh()"
          @remove="collection.removePokemon(item.name)"
        />
      </template>
    </div>
  </div>
</template>
