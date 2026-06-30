<script setup lang="ts">
import { computed, ref, watch } from "vue";

definePageMeta({ middleware: "admin" });

interface Stats {
  totalConversations: number;
  totalMessages: number;
  avgMessages: number;
  withReco: number;
  openLeads: number;
  totalLeads: number;
  conversionRate: number;
  topBoards: { woo_id: number; name: string; count: number }[];
  leadsByReason: Record<string, number>;
  leadsByStatus: Record<string, number>;
  conversationsByDay: { date: string; count: number }[];
}
interface ConvoItem {
  id: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
  product_context: { name?: string } | null;
  recommended_woo_ids: number[] | null;
  message_count: number;
}

const { t } = useI18n();

const { data: stats } = await useFetch<Stats>("/api/admin/stats");

// --- Conversation list: debounced search + server pagination ---
const searchInput = ref("");
const search = ref("");
const page = ref(1);
const perPage = 25;
let debounce: ReturnType<typeof setTimeout> | undefined;
watch(searchInput, (v) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    search.value = v.trim();
    page.value = 1;
  }, 300);
});

const { data: convData } = await useFetch<{ items: ConvoItem[]; total: number }>(
  "/api/admin/conversations",
  { query: { q: search, page, perPage } },
);

// --- Analytics helpers ---
const maxDay = computed(() =>
  Math.max(1, ...(stats.value?.conversationsByDay?.map((d) => d.count) ?? [0])),
);
const STATUSES = ["new", "in_progress", "done"] as const;
const REASONS = ["callback", "sav", "quote", "custom_shape", "other"] as const;
const statusBreakdown = computed(() =>
  STATUSES.map((s) => ({
    key: s,
    label: t(`admin.leads.status.${s}`),
    count: stats.value?.leadsByStatus?.[s] ?? 0,
  })).filter((x) => x.count > 0),
);
const reasonBreakdown = computed(() =>
  REASONS.map((r) => ({
    key: r,
    label: t(`admin.leads.reason.${r}`),
    count: stats.value?.leadsByReason?.[r] ?? 0,
  })).filter((x) => x.count > 0),
);
const STATUS_COLORS: Record<string, string> = {
  new: "bg-info",
  in_progress: "bg-warning",
  done: "bg-success",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
function fmtDay(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <h1 class="text-xl font-semibold">{{ $t("admin.conversations") }}</h1>

    <!-- KPI cards -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard>
        <p class="text-sm text-muted">{{ $t("admin.conversations") }}</p>
        <p class="text-2xl font-semibold">
          {{ stats?.totalConversations ?? 0 }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">{{ $t("admin.stats.conversionRate") }}</p>
        <p class="text-2xl font-semibold">{{ stats?.conversionRate ?? 0 }}%</p>
        <p class="text-xs text-muted mt-0.5">
          {{ $t("admin.stats.leadsTotal", { count: stats?.totalLeads ?? 0 }) }}
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
        <p class="text-sm text-muted">{{ $t("admin.stats.avgMessages") }}</p>
        <p class="text-2xl font-semibold">{{ stats?.avgMessages ?? 0 }}</p>
      </UCard>
    </div>

    <!-- Activity chart + leads breakdown -->
    <div class="grid gap-4 lg:grid-cols-3">
      <UCard class="lg:col-span-2">
        <template #header>
          <p class="font-medium text-sm">{{ $t("admin.stats.activity14") }}</p>
        </template>
        <div class="flex items-end gap-1 h-32">
          <div
            v-for="d in stats?.conversationsByDay ?? []"
            :key="d.date"
            class="flex-1 h-full flex items-end"
            :title="`${fmtDay(d.date)} · ${d.count}`"
          >
            <div
              class="w-full rounded-t bg-primary/70 min-h-px transition-all"
              :style="{ height: `${(d.count / maxDay) * 100}%` }"
            />
          </div>
        </div>
        <div class="mt-1 flex justify-between text-[10px] text-muted">
          <span>{{ fmtDay(stats?.conversationsByDay?.[0]?.date ?? "") }}</span>
          <span>{{
            fmtDay(stats?.conversationsByDay?.at(-1)?.date ?? "")
          }}</span>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <p class="font-medium text-sm">{{ $t("admin.stats.leadsByStatus") }}</p>
        </template>
        <div v-if="stats?.totalLeads" class="space-y-3">
          <div class="space-y-1.5">
            <div
              v-for="s in statusBreakdown"
              :key="s.key"
              class="flex items-center gap-2 text-sm"
            >
              <span
                class="size-2.5 rounded-full shrink-0"
                :class="STATUS_COLORS[s.key]"
              />
              <span class="flex-1 truncate">{{ s.label }}</span>
              <span class="text-muted">{{ s.count }}</span>
            </div>
          </div>
          <div class="border-t border-default pt-2">
            <p class="text-xs text-muted mb-1.5">
              {{ $t("admin.stats.leadsByReason") }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="r in reasonBreakdown"
                :key="r.key"
                color="neutral"
                variant="soft"
                size="sm"
              >
                {{ r.label }} · {{ r.count }}
              </UBadge>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-muted">—</p>
      </UCard>
    </div>

    <!-- Top boards -->
    <UCard v-if="stats?.topBoards?.length">
      <template #header>
        <p class="font-medium text-sm">{{ $t("admin.topBoards") }}</p>
      </template>
      <ol class="text-sm space-y-1">
        <li
          v-for="b in stats.topBoards"
          :key="b.woo_id"
          class="flex justify-between gap-2"
        >
          <span class="truncate">{{ b.name }}</span>
          <span class="text-muted shrink-0">{{ b.count }}×</span>
        </li>
      </ol>
    </UCard>

    <!-- Conversation list -->
    <div class="space-y-3">
      <UInput
        v-model="searchInput"
        icon="i-lucide-search"
        :placeholder="$t('admin.searchConversations')"
        :trailing="false"
      />
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <div
          v-if="!convData?.items?.length"
          class="p-6 text-center text-muted text-sm"
        >
          {{ $t("admin.none") }}
        </div>
        <NuxtLink
          v-for="c in convData?.items ?? []"
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
                ·
                {{ $t("admin.viewedProduct", { name: c.product_context.name }) }}
              </span>
            </p>
          </div>
          <div class="flex items-center gap-3 shrink-0 text-xs text-muted">
            <span>{{
              $t("admin.messagesCount", { count: c.message_count })
            }}</span>
            <UBadge
              v-if="c.recommended_woo_ids?.length"
              color="primary"
              variant="subtle"
              size="sm"
            >
              {{ $t("admin.recoCount", { count: c.recommended_woo_ids.length }) }}
            </UBadge>
            <UIcon name="i-lucide-chevron-right" class="size-4" />
          </div>
        </NuxtLink>
      </UCard>

      <div v-if="(convData?.total ?? 0) > perPage" class="flex justify-center">
        <UPagination
          v-model:page="page"
          :items-per-page="perPage"
          :total="convData?.total ?? 0"
        />
      </div>
    </div>
  </UContainer>
</template>
