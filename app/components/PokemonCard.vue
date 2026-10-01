<script setup lang="ts">
defineProps<{
  pokemon: PokemonListItem
  /** Show the "Caught" badge (browse screen). */
  caught?: boolean
  /** Show when it was caught (collection screen). */
  caughtAt?: string
  /** Show a remove button that does not open the details panel. */
  removable?: boolean
}>()
defineEmits<{ remove: [] }>()

const panel = usePokemonPanel()
</script>

<template>
  <div class="relative" :data-testid="`pokemon-card-${pokemon.name}`">
    <NuxtLink
      :to="panel.to(pokemon.name)"
      class="
        block rounded-xl border border-default bg-default p-3 transition
        hover:border-primary hover:shadow-md
        focus-visible:outline-2 focus-visible:outline-primary
      "
    >
      <PokemonImage
        :url="pokemon.imageUrl"
        :shiny="pokemon.shiny"
        :alt="displayName(pokemon.name)"
      />

      <div class="mt-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p class="text-xs text-muted">
            #{{ String(pokemon.id).padStart(4, '0') }}
          </p>
          <p class="truncate font-semibold">
            {{ displayName(pokemon.name) }}
          </p>
        </div>
        <UBadge
          v-if="caught"
          variant="subtle"
          label="Caught"
          data-testid="caught-badge"
        />
      </div>

      <!--
        The server and the browser can be in different time zones; the browser's
        date wins.
      -->
      <p
        v-if="caughtAt"
        class="mt-1 text-xs text-muted"
        :title="formatCaughtDateTime(caughtAt)"
        data-allow-mismatch
        data-testid="caught-date"
      >
        {{ `Caught ${formatCaughtDate(caughtAt)}` }}
      </p>
    </NuxtLink>

    <UButton
      v-if="removable"
      class="absolute left-2 top-2"
      icon="i-lucide-x"
      color="neutral"
      size="xs"
      :aria-label="`Remove ${displayName(pokemon.name)}`"
      data-testid="remove-button"
      @click="$emit('remove')"
    />
  </div>
</template>
