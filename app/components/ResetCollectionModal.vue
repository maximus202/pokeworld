<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })
const { reset } = useCollection()

const resetting = ref(false)
const error = ref('')

// Start each time with no leftover error.
watch(open, () => (error.value = ''))

async function confirm() {
  resetting.value = true
  error.value = ''
  try {
    await reset()
    open.value = false
  }
  catch {
    error.value = 'Couldn\'t reset your collection. Nothing was changed. Please try again.'
  }
  finally {
    resetting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Reset your collection?"
    description="This removes every Pokemon you've caught. It can't be undone."
  >
    <template v-if="error" #body>
      <UAlert color="error" variant="subtle" :description="error" data-testid="reset-error" />
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" label="Cancel" data-testid="reset-cancel" @click="open = false" />
        <UButton label="Reset" :loading="resetting" data-testid="reset-confirm" @click="confirm" />
      </div>
    </template>
  </UModal>
</template>
