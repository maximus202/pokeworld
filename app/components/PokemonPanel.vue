<script setup lang="ts">
const panel = usePokemonPanel()
const collection = useCollection()

const open = computed({
  get: () => !!panel.selected.value,
  set: (value) => {
    if (!value) panel.close()
  }
})

// Details load client-side. The last Pokemon stays in place while the panel closes so the
// slide-out animation doesn't go blank.
const pokemon = ref<PokemonDetails | null>(null)
const status = ref<'idle' | 'pending' | 'done' | 'notfound' | 'error'>(panel.selected.value ? 'pending' : 'idle')

// Ignore a slow response for a Pokemon the visitor has already moved on from.
let requestId = 0
async function load(name: string) {
  const id = ++requestId
  status.value = 'pending'
  try {
    const result = await $fetch<PokemonDetails>(`/api/pokemon/${name}`)
    if (id !== requestId) return
    pokemon.value = result
    status.value = 'done'
  } catch (error) {
    if (id !== requestId) return
    pokemon.value = null
    status.value = (error as { statusCode?: number }).statusCode === 404 ? 'notfound' : 'error'
  }
}

watch(panel.selected, (name) => {
  if (name && !import.meta.server) load(name)
}, { immediate: true })

const busy = ref(false)
const caught = computed(() => !!pokemon.value && collection.has(pokemon.value.name))
const caughtAt = computed(() => (pokemon.value ? collection.caughtAt(pokemon.value.name) : undefined))

async function toggle() {
  if (!pokemon.value || busy.value) return
  busy.value = true
  try {
    if (caught.value) await collection.removePokemon(pokemon.value.name)
    else await collection.catchPokemon(pokemon.value.name)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    :title="pokemon && status === 'done' ? displayName(pokemon.name) : 'Pokemon'"
    description="Pokemon details"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div v-if="status === 'pending'" class="space-y-4" data-testid="panel-loading">
        <USkeleton class="h-64 w-full" />
        <USkeleton class="h-6 w-1/2" />
        <USkeleton class="h-6 w-1/3" />
      </div>
      <UAlert
        v-else-if="status === 'notfound'"
        color="error"
        variant="subtle"
        title="Pokemon not found"
        description="There is no Pokemon with that name."
        data-testid="panel-error"
      />
      <UAlert
        v-else-if="status === 'error' || !pokemon"
        color="error"
        variant="subtle"
        title="Couldn't load this Pokemon"
        description="Something went wrong talking to PokeAPI."
        data-testid="panel-error"
      >
        <template #actions>
          <UButton
            color="error"
            variant="outline"
            label="Try again"
            data-testid="panel-retry"
            @click="panel.selected.value && load(panel.selected.value)"
          />
        </template>
      </UAlert>
      <div v-else class="space-y-5" data-testid="pokemon-panel">
        <PokemonImage
          :url="pokemon.image.url"
          :shiny="pokemon.image.shiny"
          :alt="displayName(pokemon.name)"
          size="lg"
        />
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt class="text-muted">
            Name
          </dt>
          <dd class="font-semibold" data-testid="panel-name">
            {{ displayName(pokemon.name) }}
          </dd>
          <dt class="text-muted">
            Height
          </dt>
          <dd data-testid="panel-height">
            {{ formatHeight(pokemon.height) }}
          </dd>
          <dt class="text-muted">
            Types
          </dt>
          <dd class="flex flex-wrap gap-1" data-testid="panel-types">
            <UBadge v-for="type in pokemon.types" :key="type" :label="displayName(type)" variant="outline" color="neutral" />
          </dd>
          <dt class="text-muted">
            Abilities
          </dt>
          <dd class="flex flex-wrap gap-1" data-testid="panel-abilities">
            <UBadge v-for="ability in pokemon.abilities" :key="ability" :label="displayName(ability)" variant="subtle" color="neutral" />
          </dd>
          <template v-if="caughtAt">
            <dt class="text-muted">
              Caught
            </dt>
            <dd :title="formatCaughtDateTime(caughtAt)" data-testid="panel-caught-date">
              {{ formatCaughtDate(caughtAt) }}
            </dd>
          </template>
        </dl>
      </div>
    </template>
    <template v-if="pokemon && status === 'done'" #footer>
      <UButton
        block
        size="lg"
        :color="caught ? 'neutral' : 'primary'"
        :variant="caught ? 'outline' : 'solid'"
        :loading="busy"
        :label="caught ? 'Remove' : 'Catch'"
        :icon="caught ? 'i-lucide-x' : 'i-lucide-circle-dot'"
        data-testid="catch-toggle"
        @click="toggle"
      />
    </template>
  </USlideover>
</template>
