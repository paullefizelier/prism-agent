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

    <USeparator icon="i-simple-icons-nuxtdotjs" />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Built with Nuxt UI • © {{ new Date().getFullYear() }}
        </p>
      </template>

      <template #right>
        <UButton
          to="https://github.com/nuxt-ui-templates/starter"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </div>
</template>
