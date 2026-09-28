<script setup lang="ts">
const props = defineProps<{
  url: string | null
  shiny: boolean
  alt: string
  size?: 'sm' | 'lg'
}>()

// If a shiny image is missing upstream, fall back to the default one and drop the badge.
const failed = ref(false)
watch(() => props.url, () => (failed.value = false))

const src = computed(() => {
  if (!props.url) return null
  return failed.value ? (defaultImageFallback(props.url) ?? props.url) : props.url
})
const showBadge = computed(() => props.shiny && !failed.value && !!src.value)

function onError() {
  if (!failed.value && props.url && defaultImageFallback(props.url)) failed.value = true
}

// A server-rendered <img> can fail to load before Vue hydrates and attaches @error, so that
// event is missed. Check once on mount for an image that has already finished loading as broken.
const img = ref<HTMLImageElement | null>(null)
onMounted(() => {
  const el = img.value
  if (el && el.complete && el.naturalWidth === 0) onError()
})
</script>

<template>
  <div
    class="relative flex items-center justify-center rounded-xl bg-elevated"
    :class="size === 'lg' ? 'h-64' : 'h-40'"
  >
    <img
      v-if="src"
      ref="img"
      :src="src"
      :alt="alt"
      loading="lazy"
      class="max-h-full max-w-full object-contain p-2"
      @error="onError"
    >
    <span v-else class="text-sm text-muted">No image</span>
    <UBadge
      v-if="showBadge"
      color="secondary"
      variant="solid"
      label="Shiny"
      icon="i-lucide-sparkles"
      class="absolute right-2 top-2 text-neutral-900"
      data-testid="shiny-badge"
    />
  </div>
</template>
