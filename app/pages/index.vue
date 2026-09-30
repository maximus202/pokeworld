<script setup lang="ts">
import type { PokemonListResponse } from '#shared/types/pokemon'

const PAGE_SIZE = 24
const collection = useCollection()
const { filters, update, clear } = useBrowseFilters()

// The search box keeps its own text and updates the URL after a short pause.
const search = ref(filters.value.q)
let timer: ReturnType<typeof setTimeout>
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => update({ q: value.trim() }), 250)
})
onBeforeUnmount(() => clearTimeout(timer))
// Follow the URL when it changes elsewhere (e.g. "Clear filters"), but not while typing.
watch(() => filters.value.q, q => q !== search.value.trim() && (search.value = q))

const { data: typeData } = await useFetch<{ types: string[] }>('/api/types')
const typeItems = computed(() => [
  { label: 'All types', value: 'all' },
  ...(typeData.value?.types ?? []).map(type => ({ label: displayName(type), value: type })),
])

const query = (offset: number) => ({
  q: filters.value.q || undefined,
  type: filters.value.type || undefined,
  caught: filters.value.caught ? 'true' : undefined,
  limit: PAGE_SIZE,
  offset,
})
const { data, status, error, refresh } = await useFetch<PokemonListResponse>('/api/pokemon', { query: computed(() => query(0)) })

// Pages after the first, added by "Load more". A new search or filter starts again from page one.
const more = ref<PokemonListItem[]>([])
watch(data, () => (more.value = []))
const items = computed(() => [...(data.value?.items ?? []), ...more.value])
const remaining = computed(() => (data.value?.total ?? 0) - items.value.length)

const loadingMore = ref(false)
async function loadMore() {
  loadingMore.value = true
  try {
    more.value.push(...(await $fetch<PokemonListResponse>('/api/pokemon', { query: query(items.value.length) })).items)
  }
  catch {
    useToast().add({ title: 'Couldn\'t load more Pokemon', description: 'Please try again.', color: 'error' })
  }
  finally {
    loadingMore.value = false
  }
}

// Catching or removing changes what belongs in a "Caught only" list.
watch(collection.count, () => filters.value.caught && refresh())
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-3">
      <UInput v-model="search" icon="i-lucide-search" size="xl" placeholder="Search Pokemon by name" class="w-full" aria-label="Search Pokemon by name" data-testid="search-input" />
      <div class="flex flex-wrap items-center gap-4">
        <USelect
          :model-value="filters.type || 'all'"
          :items="typeItems"
          class="w-48"
          aria-label="Filter by type"
          data-testid="type-filter"
          @update:model-value="update({ type: $event === 'all' ? '' : $event })"
        />
        <USwitch :model-value="filters.caught" label="Caught only" data-testid="caught-only" @update:model-value="update({ caught: $event ? 'true' : '' })" />
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" title="Couldn't load Pokemon" description="Something went wrong talking to PokeAPI." data-testid="list-error">
      <template #actions>
        <UButton color="error" variant="outline" label="Try again" data-testid="list-retry" @click="refresh()" />
      </template>
    </UAlert>

    <div v-else-if="status === 'pending' && !items.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" data-testid="list-loading">
      <USkeleton v-for="n in 12" :key="n" class="h-56" />
    </div>

    <div v-else-if="!items.length && filters.caught && !filters.q && !filters.type" class="py-16 text-center" data-testid="caught-empty">
      <p class="text-lg font-semibold">
        You haven't caught any Pokemon yet
      </p>
      <p class="mb-4 text-muted">
        Open a Pokemon and press Catch to add it to your collection.
      </p>
      <UButton label="Show all Pokemon" data-testid="show-all" @click="update({ caught: '' })" />
    </div>

    <div v-else-if="!items.length" class="py-16 text-center" data-testid="no-matches">
      <p class="text-lg font-semibold">
        No matches
      </p>
      <p class="mb-4 text-muted">
        {{ filters.q ? `No Pokemon match "${filters.q}" with these filters.` : 'No Pokemon match these filters.' }}
      </p>
      <UButton variant="outline" label="Clear filters" data-testid="clear-filters" @click="clear()" />
    </div>

    <template v-else>
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" data-testid="pokemon-list">
        <PokemonCard v-for="pokemon in items" :key="pokemon.id" :pokemon="pokemon" :caught="collection.has(pokemon.name)" />
      </div>
      <div v-if="remaining > 0" class="flex justify-center">
        <UButton variant="outline" :loading="loadingMore" :label="`Load more (${remaining} left)`" data-testid="load-more" @click="loadMore" />
      </div>
    </template>
  </div>
</template>
