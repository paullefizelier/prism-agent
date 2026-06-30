<script setup lang="ts">
// Admin shell layout. Only the /admin/* pages use this layout (the public chat
// and login use the bare `embed` layout), so it's safe to make it admin-specific:
// section nav + language toggle + logout.
import { computed } from "vue";

const route = useRoute();
const { locale, setLocale } = useI18n();
const supabase = useSupabaseClient();

const isLeads = computed(() => route.path.startsWith("/admin/leads"));
const isProducts = computed(() => route.path.startsWith("/admin/products"));
// Anything else under /admin (the list and the /admin/[id] detail) is a conversation.
const isConversations = computed(() => !isLeads.value && !isProducts.value);

async function logout() {
  await supabase.auth.signOut();
  navigateTo("/login");
}
</script>

<template>
  <div>
    <UHeader>
      <template #left>
        <NuxtLink to="/admin" class="flex items-center gap-2">
          <NuxtImg
            src="/logo-prism-surfboards.png.webp"
            class="w-auto h-9 shrink-0"
            format="webp"
          />
          <span class="font-semibold hidden sm:inline">Admin</span>
        </NuxtLink>
      </template>

      <UButton
        to="/admin"
        :label="$t('admin.conversations')"
        icon="i-lucide-messages-square"
        :color="isConversations ? 'primary' : 'neutral'"
        :variant="isConversations ? 'soft' : 'ghost'"
        size="sm"
      />
      <UButton
        to="/admin/leads"
        :label="$t('admin.leads.title')"
        icon="i-lucide-inbox"
        :color="isLeads ? 'primary' : 'neutral'"
        :variant="isLeads ? 'soft' : 'ghost'"
        size="sm"
      />
      <UButton
        to="/admin/products"
        :label="$t('admin.products.title')"
        icon="i-lucide-package"
        :color="isProducts ? 'primary' : 'neutral'"
        :variant="isProducts ? 'soft' : 'ghost'"
        size="sm"
      />

      <template #right>
        <UTooltip :text="$t('chat.switchLanguage')">
          <UButton
            :label="locale === 'fr' ? 'EN' : 'FR'"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="setLocale(locale === 'fr' ? 'en' : 'fr')"
          />
        </UTooltip>
        <UButton
          href="https://www.prism-surfboards.com"
          target="_blank"
          rel="noopener"
          trailing-icon="i-lucide-arrow-up-right"
          :label="$t('admin.viewSite')"
          color="neutral"
          variant="ghost"
          size="sm"
          class="hidden sm:inline-flex"
        />
        <UButton
          :label="$t('admin.logout')"
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="logout"
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
