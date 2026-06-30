<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface Stats {
  totalConversations: number
  totalMessages: number
  openLeads: number
  topBoards: { woo_id: number, name: string, count: number }[]
}
interface ConvoItem {
  id: string
  created_at: string
  updated_at: string
  preview: string | null
  product_context: { name?: string } | null
  recommended_woo_ids: number[] | null
  message_count: number
}

const { data: stats } = await useFetch<Stats>('/api/admin/stats')
const { data: conversations }
  = await useFetch<ConvoItem[]>('/api/admin/conversations')

function fmtDate(d: string) {
  return new Date(d).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

</script>

<template>
  <UContainer class="py-8 space-y-6">
    <h1 class="text-xl font-semibold">
      {{ $t("admin.conversations") }}
    </h1>

    <!-- Stats -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard>
        <p class="text-sm text-muted">
          {{ $t("admin.conversations") }}
        </p>
        <p class="text-2xl font-semibold">
          {{ stats?.totalConversations ?? 0 }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          {{ $t("admin.messages") }}
        </p>
        <p class="text-2xl font-semibold">
          {{ stats?.totalMessages ?? 0 }}
        </p>
      </UCard>
      <NuxtLink to="/admin/leads" class="block">
        <UCard class="h-full transition hover:bg-elevated">
          <p class="text-sm text-muted flex items-center gap-1.5">
            <UIcon name="i-lucide-inbox" class="size-4" />
            {{ $t("admin.leads.openCard") }}
          </p>
          <p
            class="text-2xl font-semibold"
            :class="stats?.openLeads ? 'text-info' : ''"
          >
            {{ stats?.openLeads ?? 0 }}
          </p>
        </UCard>
      </NuxtLink>
      <UCard>
        <p class="text-sm text-muted mb-1">
          {{ $t("admin.topBoards") }}
        </p>
        <ol
          v-if="stats?.topBoards?.length"
          class="text-sm space-y-0.5"
        >
          <li
            v-for="b in stats.topBoards"
            :key="b.woo_id"
            class="flex justify-between gap-2"
          >
            <span class="truncate">{{ b.name }}</span>
            <span class="text-muted shrink-0">{{ b.count }}×</span>
          </li>
        </ol>
        <p
          v-else
          class="text-sm text-muted"
        >
          —
        </p>
      </UCard>
    </div>

    <!-- Conversation list -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div
        v-if="!conversations?.length"
        class="p-6 text-center text-muted text-sm"
      >
        {{ $t("admin.none") }}
      </div>
      <NuxtLink
        v-for="c in conversations"
        :key="c.id"
        :to="`/admin/${c.id}`"
        class="flex items-center justify-between gap-4 px-4 py-3 border-b border-default last:border-0 hover:bg-elevated transition"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">
            {{ c.preview || $t("admin.noPreview") }}
          </p>
          <p class="text-xs text-muted">
            {{ fmtDate(c.created_at) }}
            <span v-if="c.product_context?.name">
              · {{ $t("admin.viewedProduct", { name: c.product_context.name }) }}
            </span>
          </p>
        </div>
        <div class="flex items-center gap-3 shrink-0 text-xs text-muted">
          <span>{{ $t("admin.messagesCount", { count: c.message_count }) }}</span>
          <UBadge
            v-if="c.recommended_woo_ids?.length"
            color="primary"
            variant="subtle"
            size="sm"
          >
            {{ $t("admin.recoCount", { count: c.recommended_woo_ids.length }) }}
          </UBadge>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4"
          />
        </div>
      </NuxtLink>
    </UCard>
  </UContainer>
</template>
