<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <div class="min-h-screen bg-default">
      <AppHeader />
      <UMain>
        <UContainer class="py-6">
          <NuxtPage />
        </UContainer>
      </UMain>
      <PokemonPanel />
    </div>
  </UApp>
</template>
