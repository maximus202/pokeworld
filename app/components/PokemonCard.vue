<script setup lang="ts">
defineProps<{ pokemon: PokemonListItem, caught?: boolean }>()
const panel = usePokemonPanel()
</script>

<template>
  <NuxtLink
    :to="panel.to(pokemon.name)"
    class="group block rounded-xl border border-default bg-default p-3 transition hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    :data-testid="`pokemon-card-${pokemon.name}`"
  >
    <PokemonImage :url="pokemon.imageUrl" :shiny="pokemon.shiny" :alt="displayName(pokemon.name)" />
    <div class="mt-3 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="text-xs text-muted">
          #{{ String(pokemon.id).padStart(4, '0') }}
        </p>
        <p class="truncate font-semibold">
          {{ displayName(pokemon.name) }}
        </p>
      </div>
      <UBadge v-if="caught" color="primary" variant="subtle" label="Caught" />
    </div>
  </NuxtLink>
</template>
