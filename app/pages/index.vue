<script setup lang="ts">
const requestFetch = useRequestFetch()
const { data: me } = await useAsyncData('me', () => requestFetch<{ label: string }>('/api/me'))
</script>

<template>
  <div data-testid="visitor-label">{{ me?.label }}</div>
</template>
