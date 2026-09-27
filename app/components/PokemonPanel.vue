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
const status = ref<'idle' | 'pending' | 'done' | 'error'>(panel.selected.value ? 'pending' : 'idle')
const error = computed(() => status.value === 'error')

let requestId = 0
watch(panel.selected, async (name) => {
  if (!name || import.meta.server) return
  const id = ++requestId
  status.value = 'pending'
  try {
    const result = await $fetch<PokemonDetails>(`/api/pokemon/${name}`)
    if (id !== requestId) return
    pokemon.value = result
    status.value = 'done'
  } catch {
    if (id !== requestId) return
    pokemon.value = null
    status.value = 'error'
  }
}, { immediate: true })

const busy = ref(false)
const caught = computed(() => !!pokemon.value && collection.has(pokemon.value.name))

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
    :title="pokemon && !error ? displayName(pokemon.name) : 'Pokemon'"
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
        v-else-if="error || !pokemon"
        color="error"
        variant="subtle"
        title="Pokemon not found"
        description="We couldn't load that Pokemon."
        data-testid="panel-error"
      />
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
          <dd class="flex flex-wrap gap-1">
            <UBadge v-for="type in pokemon.types" :key="type" :label="displayName(type)" variant="outline" color="neutral" />
          </dd>
          <dt class="text-muted">
            Abilities
          </dt>
          <dd class="flex flex-wrap gap-1" data-testid="panel-abilities">
            <UBadge v-for="ability in pokemon.abilities" :key="ability" :label="displayName(ability)" variant="subtle" color="neutral" />
          </dd>
        </dl>
      </div>
    </template>
    <template v-if="pokemon && status !== 'pending' && !error" #footer>
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
