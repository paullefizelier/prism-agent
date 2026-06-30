<script setup lang="ts">
// Full-screen chat for the chat.prism-surfboards.com home page: a permanent
// conversation sidebar (collapsible on desktop, slideover on mobile) alongside
// the chat panel.
definePageMeta({ layout: "embed" });
</script>

<template>
  <UDashboardGroup class="h-dvh">
    <UDashboardSidebar
      collapsible
      resizable
      :min-size="16"
      :default-size="20"
      :max-size="30"
      :ui="{ body: 'min-h-0' }"
    >
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-messages-square" class="size-5 text-primary" />
          <span class="font-semibold">{{ $t("history.heading") }}</span>
        </div>
      </template>

      <template #default>
        <ChatHistoryList />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <SurfChat />
    </UDashboardPanel>
  </UDashboardGroup>
</template>
