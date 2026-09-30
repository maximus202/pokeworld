<script setup lang="ts">
import type { PokemonDetails } from '#shared/types/pokemon'

const panel = usePokemonPanel()
const collection = useCollection()

const open = computed({
  get: () => !!panel.selected.value,
  set: open => !open && panel.close(),
})

// Details load in the browser. The last Pokemon stays in place while the panel slides shut.
const details = ref<PokemonDetails>()
const status = ref<'pending' | 'error' | 'done'>('pending')
let latest = ''
async function load(name: string) {
  latest = name
  status.value = 'pending'
  try {
    const result = await $fetch<PokemonDetails>(`/api/pokemon/${encodeURIComponent(name)}`) // the name comes from the URL
    if (name === latest) [details.value, status.value] = [result, 'done'] // else: the visitor moved on
  }
  catch {
    if (name === latest) status.value = 'error'
  }
}
onMounted(() => panel.selected.value && load(panel.selected.value))
watch(panel.selected, name => name && load(name))

const caughtAt = computed(() => details.value && collection.caughtAt(details.value.name))
const busy = ref(false)
async function toggle(name: string) {
  busy.value = true
  try {
    await (caughtAt.value ? collection.removePokemon(name) : collection.catchPokemon(name))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <USlideover v-model:open="open" :title="status === 'done' && details ? displayName(details.name) : 'Pokemon'" description="Pokemon details" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div v-if="status === 'pending'" class="space-y-4" data-testid="panel-loading">
        <USkeleton class="h-40 w-full" />
        <USkeleton class="h-6 w-1/2" />
        <USkeleton class="h-6 w-1/3" />
      </div>
      <UAlert v-else-if="status === 'error'" color="error" variant="subtle" title="Couldn't load this Pokemon" description="Something went wrong talking to PokeAPI." data-testid="panel-error">
        <template #actions>
          <UButton color="error" variant="outline" label="Try again" data-testid="panel-retry" @click="panel.selected.value && load(panel.selected.value)" />
        </template>
      </UAlert>
      <div v-else-if="details" class="space-y-5" data-testid="pokemon-panel">
        <PokemonImage :url="details.image.url" :shiny="details.image.shiny" :alt="displayName(details.name)" />
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt class="text-muted">
            Name
          </dt>
          <dd class="font-semibold" data-testid="panel-name">
            {{ displayName(details.name) }}
          </dd>
          <dt class="text-muted">
            Number
          </dt>
          <dd>{{ `#${String(details.id).padStart(4, '0')}` }}</dd>
          <dt class="text-muted">
            Height
          </dt>
          <dd data-testid="panel-height">
            {{ formatHeight(details.height) }}
          </dd>
          <dt class="text-muted">
            Types
          </dt>
          <dd class="flex flex-wrap gap-1" data-testid="panel-types">
            <UBadge v-for="type in details.types" :key="type" :label="displayName(type)" variant="outline" color="neutral" />
          </dd>
          <dt class="text-muted">
            Abilities
          </dt>
          <dd class="flex flex-wrap gap-1" data-testid="panel-abilities">
            <UBadge v-for="ability in details.abilities" :key="ability" :label="displayName(ability)" variant="subtle" color="neutral" />
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
    <template v-if="status === 'done' && details" #footer>
      <UButton block size="lg" :color="caughtAt ? 'neutral' : 'primary'" :variant="caughtAt ? 'outline' : 'solid'" :loading="busy" :label="caughtAt ? 'Remove' : 'Catch'" data-testid="catch-toggle" @click="toggle(details.name)" />
    </template>
  </USlideover>
</template>
