<script setup lang="ts">
import { computed, ref } from "vue";

definePageMeta({ middleware: "admin" });

type Reason = "callback" | "sav" | "quote" | "custom_shape" | "other";

interface Lead {
  id: string;
  created_at: string;
  reason: Reason;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  product_context: { name?: string } | null;
  conversation_id: string | null;
}

const { data: leads } = await useFetch<Lead[]>("/api/admin/leads");

const REASON_COLORS: Record<Reason, string> = {
  callback: "info",
  sav: "warning",
  quote: "primary",
  custom_shape: "secondary",
  other: "neutral",
};

// Reason filter: null = all.
const activeReason = ref<Reason | null>(null);

const reasonsPresent = computed<Reason[]>(() => {
  const set = new Set<Reason>();
  for (const l of leads.value ?? []) set.add(l.reason);
  return [...set];
});

const filtered = computed(() =>
  activeReason.value
    ? (leads.value ?? []).filter((l) => l.reason === activeReason.value)
    : (leads.value ?? []),
);

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        to="/admin"
        :label="$t('admin.back')"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
      />
      <h1 class="text-xl font-semibold">{{ $t("admin.leads.title") }}</h1>
    </div>

    <!-- Reason filter -->
    <div v-if="reasonsPresent.length > 1" class="flex flex-wrap gap-1.5">
      <UButton
        :label="$t('admin.leads.all')"
        :color="activeReason === null ? 'primary' : 'neutral'"
        :variant="activeReason === null ? 'solid' : 'soft'"
        size="xs"
        @click="activeReason = null"
      />
      <UButton
        v-for="r in reasonsPresent"
        :key="r"
        :label="$t(`admin.leads.reason.${r}`)"
        :color="activeReason === r ? 'primary' : 'neutral'"
        :variant="activeReason === r ? 'solid' : 'soft'"
        size="xs"
        @click="activeReason = r"
      />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div v-if="!filtered.length" class="p-6 text-center text-muted text-sm">
        {{ $t("admin.leads.none") }}
      </div>
      <div
        v-for="l in filtered"
        :key="l.id"
        class="flex flex-col gap-2 px-4 py-3 border-b border-default last:border-0"
      >
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <UBadge
                :color="(REASON_COLORS[l.reason] as any)"
                variant="subtle"
                size="sm"
              >
                {{ $t(`admin.leads.reason.${l.reason}`) }}
              </UBadge>
              <p class="text-sm font-medium">{{ l.name }}</p>
            </div>
            <p class="text-xs text-muted mt-0.5">
              <a :href="`mailto:${l.email}`" class="hover:text-primary">
                {{ l.email }}
              </a>
              <span v-if="l.phone">
                ·
                <a :href="`tel:${l.phone}`" class="hover:text-primary">
                  {{ l.phone }}
                </a>
              </span>
            </p>
          </div>
          <div class="flex items-center gap-3 shrink-0 text-xs text-muted">
            <span>{{ fmtDate(l.created_at) }}</span>
            <UButton
              v-if="l.conversation_id"
              :to="`/admin/${l.conversation_id}`"
              :label="$t('admin.leads.viewConversation')"
              icon="i-lucide-messages-square"
              color="neutral"
              variant="ghost"
              size="xs"
            />
          </div>
        </div>
        <p class="text-sm whitespace-pre-wrap">{{ l.message }}</p>
        <p v-if="l.product_context?.name" class="text-xs text-muted">
          {{ $t("admin.viewedProduct", { name: l.product_context.name }) }}
        </p>
      </div>
    </UCard>
  </UContainer>
</template>
