<script setup lang="ts">
const collection = useCollection()

// Resolve each caught name through the details endpoint (served from the server cache).
const details = ref<Record<string, PokemonDetails | null>>({})

watch(collection.names, async (names) => {
  const missing = names.filter(n => !(n in details.value))
  await Promise.all(missing.map(async (name) => {
    details.value[name] = await $fetch<PokemonDetails>(`/api/pokemon/${name}`).catch(() => null)
  }))
}, { immediate: true })

const cards = computed<PokemonListItem[]>(() =>
  collection.names.value.flatMap((name) => {
    const d = details.value[name]
    return d ? [{ id: d.id, name: d.name, imageUrl: d.image.url ?? '', shiny: d.image.shiny }] : []
  })
)
const resolving = computed(() => collection.names.value.some(n => !(n in details.value)))
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      My Collection
    </h1>

    <div v-if="!collection.loaded.value || resolving" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <USkeleton v-for="n in 6" :key="n" class="h-56" />
    </div>

    <div v-else-if="!collection.names.value.length" class="py-16 text-center" data-testid="collection-empty">
      <p class="text-lg font-semibold">
        You haven't caught any Pokemon yet
      </p>
      <p class="mb-4 text-muted">
        Open a Pokemon and press Catch to add it here.
      </p>
      <UButton to="/" label="Browse Pokemon" />
    </div>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" data-testid="collection-list">
      <PokemonCard v-for="pokemon in cards" :key="pokemon.id" :pokemon="pokemon" caught />
    </div>
  </div>
</template>
