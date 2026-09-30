<script setup lang="ts">
const props = defineProps<{ url: string | null; shiny: boolean; alt: string }>()

// A missing or broken shiny image falls back to the default one, and the badge
// goes with it. If the default fails too there is nothing to show, so it falls
// back to "No image".
const failed = ref(false)
const broken = ref(false)
watch(
  () => props.url,
  () => (failed.value = broken.value = false),
)

const defaultUrl = computed(() => props.url?.replace('/shiny/', '/') ?? null)
const src = computed(() =>
  broken.value ? null : failed.value ? defaultUrl.value : props.url,
)
const showBadge = computed(
  () => props.shiny && !failed.value && !broken.value && !!props.url,
)

function onError() {
  if (!failed.value && defaultUrl.value !== props.url) failed.value = true
  else broken.value = true
}

// A server-rendered <img> can fail before Vue hydrates and attaches @error, so
// that event is missed. Check once on mount for an image that has already
// finished loading as broken.
const img = ref<HTMLImageElement>()
onMounted(() => {
  if (img.value?.complete && img.value.naturalWidth === 0) onError()
})
</script>

<template>
  <div
    class="
      relative flex h-40 items-center justify-center rounded-xl bg-elevated
    "
  >
    <img
      v-if="src"
      ref="img"
      :src="src"
      :alt="alt"
      loading="lazy"
      class="max-h-full max-w-full object-contain p-2"
      @error="onError"
    />
    <span v-else class="text-sm text-muted">No image</span>

    <UBadge
      v-if="showBadge"
      color="secondary"
      label="Shiny"
      icon="i-lucide-sparkles"
      class="absolute right-2 top-2 text-neutral-900"
      data-testid="shiny-badge"
    />
  </div>
</template>
