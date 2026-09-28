<script setup lang="ts">
const LIMIT = 24
const collection = useCollection()
const route = useRoute()
const router = useRouter()

const fromUrl = (value: unknown) => (typeof value === 'string' ? value : '')

// Search, type and "caught only" live in the URL, so a filtered view survives a reload.
const search = ref(fromUrl(route.query.q))
const q = ref(search.value.trim())
const type = ref(fromUrl(route.query.type) || 'all')
const caughtOnly = ref(route.query.caught === 'true')

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (q.value = value.trim()), 250)
})
onBeforeUnmount(() => clearTimeout(timer))

watch([q, type, caughtOnly], () => {
  const { q: _q, type: _type, caught: _caught, ...rest } = route.query
  router.replace({
    query: {
      ...rest,
      ...(q.value ? { q: q.value } : {}),
      ...(type.value !== 'all' ? { type: type.value } : {}),
      ...(caughtOnly.value ? { caught: 'true' } : {})
    }
  })
})

const filtered = computed(() => !!q.value || type.value !== 'all' || caughtOnly.value)

function clearFilters() {
  clearTimeout(timer)
  search.value = ''
  q.value = ''
  type.value = 'all'
  caughtOnly.value = false
}

const { data: typeData } = await useFetch<{ types: string[] }>('/api/types')
const typeItems = computed(() => [
  { label: 'All types', value: 'all' },
  ...(typeData.value?.types ?? []).map(t => ({ label: displayName(t), value: t }))
])

const items = ref<PokemonListItem[]>([])
const total = ref(0)
const loadingMore = ref(false)

const { data, status, error, refresh } = await useFetch<PokemonList>('/api/pokemon', {
  query: computed(() => ({
    q: q.value || undefined,
    type: type.value === 'all' ? undefined : type.value,
    caught: caughtOnly.value ? 'true' : undefined,
    limit: LIMIT,
    offset: 0
  }))
})
watch(data, (page) => {
  items.value = page?.items ?? []
  total.value = page?.total ?? 0
}, { immediate: true })

// Catching or removing while "Caught only" is on changes what belongs in the list.
watch(() => collection.count.value, () => {
  if (caughtOnly.value) refresh()
})

async function loadMore() {
  loadingMore.value = true
  try {
    const page = await $fetch<PokemonList>('/api/pokemon', {
      query: {
        q: q.value || undefined,
        type: type.value === 'all' ? undefined : type.value,
        caught: caughtOnly.value ? 'true' : undefined,
        limit: LIMIT,
        offset: items.value.length
      }
    })
    items.value = [...items.value, ...page.items]
  } catch {
    useToast().add({ title: 'Couldn\'t load more Pokemon', description: 'Please try again.', color: 'error' })
  } finally {
    loadingMore.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        size="xl"
        placeholder="Search Pokemon by name"
        class="w-full"
        :ui="{ trailing: 'pe-1' }"
        aria-label="Search Pokemon by name"
        data-testid="search-input"
      >
        <template v-if="search" #trailing>
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            icon="i-lucide-circle-x"
            aria-label="Clear search"
            data-testid="search-clear"
            @click="search = ''"
          />
        </template>
      </UInput>
      <div class="flex flex-wrap items-center gap-4">
        <USelect
          v-model="type"
          :items="typeItems"
          class="w-48"
          aria-label="Filter by type"
          data-testid="type-filter"
        />
        <USwitch v-model="caughtOnly" label="Caught only" data-testid="caught-only" />
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Couldn't load Pokemon"
      description="Something went wrong talking to PokeAPI."
      data-testid="list-error"
    >
      <template #actions>
        <UButton color="error" variant="outline" label="Try again" data-testid="list-retry" @click="refresh()" />
      </template>
    </UAlert>

    <div
      v-else-if="status === 'pending' && !items.length"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      data-testid="list-loading"
    >
      <USkeleton v-for="n in 12" :key="n" class="h-56" />
    </div>

    <div
      v-else-if="!items.length && caughtOnly && !q && type === 'all'"
      class="py-16 text-center"
      data-testid="caught-empty"
    >
      <p class="text-lg font-semibold">
        You haven't caught any Pokemon yet
      </p>
      <p class="mb-4 text-muted">
        Open a Pokemon and press Catch to add it to your collection.
      </p>
      <UButton label="Show all Pokemon" @click="clearFilters" />
    </div>

    <div v-else-if="!items.length" class="py-16 text-center" data-testid="no-matches">
      <p class="text-lg font-semibold">
        No matches
      </p>
      <p class="mb-4 text-muted">
        <template v-if="q">
          No Pokemon match "{{ q }}" with these filters.
        </template>
        <template v-else>
          No Pokemon match these filters.
        </template>
      </p>
      <UButton v-if="filtered" variant="outline" label="Clear filters" data-testid="clear-filters" @click="clearFilters" />
    </div>

    <template v-else>
      <div
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        data-testid="pokemon-list"
      >
        <PokemonCard
          v-for="pokemon in items"
          :key="pokemon.id"
          :pokemon="pokemon"
          :caught="collection.has(pokemon.name)"
        />
      </div>
      <div v-if="items.length < total" class="flex justify-center">
        <UButton
          variant="outline"
          :loading="loadingMore"
          :label="`Load more (${total - items.length} left)`"
          data-testid="load-more"
          @click="loadMore"
        />
      </div>
    </template>
  </div>
</template>
