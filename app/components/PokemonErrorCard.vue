<script setup lang="ts">
defineProps<{ name: string, caughtAt: string }>()
const emit = defineEmits<{ retry: [], remove: [] }>()
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-xl border border-error/40 bg-error/5 p-3"
    :data-testid="`pokemon-error-${name}`"
  >
    <div class="flex h-40 items-center justify-center rounded-xl bg-elevated text-sm text-muted">
      Couldn't load details
    </div>
    <p class="truncate font-semibold">
      {{ displayName(name) }}
    </p>
    <p class="text-xs text-muted" :title="formatCaughtDateTime(caughtAt)">
      Caught {{ formatCaughtDate(caughtAt) }}
    </p>
    <div class="flex gap-2">
      <UButton size="xs" variant="outline" label="Retry" data-testid="retry-button" @click="emit('retry')" />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        label="Remove"
        :aria-label="`Remove ${displayName(name)}`"
        data-testid="remove-button"
        @click="emit('remove')"
      />
    </div>
  </div>
</template>
