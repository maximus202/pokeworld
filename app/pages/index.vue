<script setup lang="ts">
const LIMIT = 24
const collection = useCollection()
const route = useRoute()
const router = useRouter()

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const q = ref(search.value)

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    q.value = value.trim()
    const { q: _omit, ...rest } = route.query
    router.replace({ query: q.value ? { ...rest, q: q.value } : rest })
  }, 250)
})
onBeforeUnmount(() => clearTimeout(timer))

const items = ref<PokemonListItem[]>([])
const total = ref(0)
const loadingMore = ref(false)

const { data, status, error, refresh } = await useFetch<PokemonList>('/api/pokemon', {
  query: computed(() => ({ q: q.value, limit: LIMIT, offset: 0 })),
  watch: [q]
})
watch(data, (page) => {
  items.value = page?.items ?? []
  total.value = page?.total ?? 0
}, { immediate: true })

async function loadMore() {
  loadingMore.value = true
  try {
    const page = await $fetch<PokemonList>('/api/pokemon', {
      query: { q: q.value, limit: LIMIT, offset: items.value.length }
    })
    items.value = [...items.value, ...page.items]
  } finally {
    loadingMore.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
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

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Couldn't load Pokemon"
      description="Something went wrong talking to PokeAPI."
    >
      <template #actions>
        <UButton color="error" variant="outline" label="Try again" @click="refresh()" />
      </template>
    </UAlert>

    <div
      v-else-if="status === 'pending' && !items.length"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
    >
      <USkeleton v-for="n in 12" :key="n" class="h-56" />
    </div>

    <div v-else-if="!items.length" class="py-16 text-center" data-testid="no-matches">
      <p class="text-lg font-semibold">
        No matches
      </p>
      <p class="text-muted">
        No Pokemon match "{{ q }}". Try another name.
      </p>
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
