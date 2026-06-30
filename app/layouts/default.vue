<script setup lang="ts"></script>

<template>
  <div>
    <UHeader>
      <template #left>
        <NuxtLink to="/">
          <NuxtImg
            src="/logo-prism-surfboards.png.webp"
            class="w-auto h-12 shrink-0"
            format="webp"
          />
        </NuxtLink>
      </template>

      <template #right>
        <UButton
          href="https://www.prism-surfboards.com"
          trailing-icon="i-lucide-arrow-up-right"
          label="Accéder au site"
        />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>

    <USeparator icon="i-lucide-waves" />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          © Prism Surfboards • {{ new Date().getFullYear() }}
        </p>
      </template>
    </UFooter>
  </div>
</template>
