<script setup lang="ts">
const { items } = useCollection()
</script>

<template>
  <!-- Placeholder: the real collection screen replaces this in the next phase. -->
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
    <PokemonCard v-for="item in items.filter(i => i.pokemon)" :key="item.name" :pokemon="item.pokemon!" :caught-at="item.caughtAt" removable @remove="useCollection().removePokemon(item.name)" />
  </div>
</template>
