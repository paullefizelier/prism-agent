<script setup lang="ts">
import { computed, ref } from "vue";

definePageMeta({ middleware: "admin" });

type Reason = "callback" | "sav" | "quote" | "custom_shape" | "other";
type Status = "new" | "in_progress" | "done";

interface Lead {
  id: string;
  created_at: string;
  reason: Reason;
  status: Status;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  product_context: { name?: string } | null;
  conversation_id: string | null;
}

const { t } = useI18n();
const toast = useToast();

const { data: leads } = await useFetch<Lead[]>("/api/admin/leads");

const REASON_COLORS: Record<Reason, string> = {
  callback: "info",
  sav: "warning",
  quote: "primary",
  custom_shape: "secondary",
  other: "neutral",
};
const STATUS_COLORS: Record<Status, string> = {
  new: "info",
  in_progress: "warning",
  done: "success",
};
const STATUSES: Status[] = ["new", "in_progress", "done"];

const statusItems = computed(() =>
  STATUSES.map((s) => ({ label: t(`admin.leads.status.${s}`), value: s })),
);

// Filters: null = all.
const activeStatus = ref<Status | null>(null);
const activeReason = ref<Reason | null>(null);

const reasonsPresent = computed<Reason[]>(() => {
  const set = new Set<Reason>();
  for (const l of leads.value ?? []) set.add(l.reason);
  return [...set];
});

const filtered = computed(() =>
  (leads.value ?? []).filter(
    (l) =>
      (!activeStatus.value || l.status === activeStatus.value) &&
      (!activeReason.value || l.reason === activeReason.value),
  ),
);

const openCount = computed(
  () => (leads.value ?? []).filter((l) => l.status === "new").length,
);

async function setStatus(lead: Lead, status: Status) {
  if (lead.status === status) return;
  const prev = lead.status;
  lead.status = status; // optimistic
  try {
    await $fetch(`/api/admin/leads/${lead.id}`, {
      method: "POST",
      body: { status },
    });
    toast.add({
      icon: "i-lucide-check",
      title: t("admin.leads.statusUpdated"),
    });
  } catch {
    lead.status = prev;
    toast.add({
      icon: "i-lucide-triangle-alert",
      color: "error",
      title: t("admin.leads.error"),
    });
  }
}

function mailtoHref(l: Lead) {
  const subject = t("admin.leads.replySubject");
  const body = `${t("admin.leads.replyBody", { name: l.name })}\n\n> ${l.message.replace(/\n/g, "\n> ")}`;
  return `mailto:${l.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
  toast.add({ icon: "i-lucide-check", title: t("common.copied") });
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
      <UBadge v-if="openCount" color="info" variant="subtle">
        {{ $t("admin.leads.openCount", { count: openCount }) }}
      </UBadge>
    </div>

    <!-- Filters -->
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-xs text-muted me-1 w-12">{{
          $t("admin.leads.statusLabel")
        }}</span>
        <UButton
          :label="$t('admin.leads.all')"
          :color="activeStatus === null ? 'primary' : 'neutral'"
          :variant="activeStatus === null ? 'solid' : 'soft'"
          size="xs"
          @click="activeStatus = null"
        />
        <UButton
          v-for="s in STATUSES"
          :key="s"
          :label="$t(`admin.leads.status.${s}`)"
          :color="activeStatus === s ? 'primary' : 'neutral'"
          :variant="activeStatus === s ? 'solid' : 'soft'"
          size="xs"
          @click="activeStatus = s"
        />
      </div>
      <div
        v-if="reasonsPresent.length > 1"
        class="flex flex-wrap items-center gap-1.5"
      >
        <span class="text-xs text-muted me-1 w-12">{{
          $t("admin.leads.reasonLabel")
        }}</span>
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
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div v-if="!filtered.length" class="p-6 text-center text-muted text-sm">
        {{ $t("admin.leads.none") }}
      </div>
      <div
        v-for="l in filtered"
        :key="l.id"
        class="flex flex-col gap-3 px-4 py-4 border-b border-default last:border-0"
        :class="{ 'opacity-60': l.status === 'done' }"
      >
        <!-- Top: reason + name + date -->
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              <UBadge
                :color="REASON_COLORS[l.reason] as any"
                variant="subtle"
                size="sm"
              >
                {{ $t(`admin.leads.reason.${l.reason}`) }}
              </UBadge>
              <span class="text-sm font-medium">{{ l.name }}</span>
            </div>
            <!-- Contact details -->
            <div
              class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
            >
              <span class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-mail" class="size-3.5" />
                <a :href="`mailto:${l.email}`" class="hover:text-primary">{{
                  l.email
                }}</a>
                <UButton
                  icon="i-lucide-copy"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="$t('common.copy')"
                  @click="copy(l.email)"
                />
              </span>
              <span v-if="l.phone" class="inline-flex items-center gap-1">
                <UIcon name="i-lucide-phone" class="size-3.5" />
                <a :href="`tel:${l.phone}`" class="hover:text-primary">{{
                  l.phone
                }}</a>
              </span>
            </div>
          </div>
          <span class="text-xs text-muted shrink-0">{{
            fmtDate(l.created_at)
          }}</span>
        </div>

        <!-- Message -->
        <p class="text-sm whitespace-pre-wrap">{{ l.message }}</p>
        <p v-if="l.product_context?.name" class="text-xs text-muted">
          {{ $t("admin.viewedProduct", { name: l.product_context.name }) }}
        </p>

        <!-- Actions: status + reply + conversation -->
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <USelectMenu
            :model-value="l.status"
            :items="statusItems"
            value-key="value"
            size="xs"
            :icon="'i-lucide-circle-dot'"
            class="w-40"
            @update:model-value="(v: any) => setStatus(l, v as Status)"
          />
          <UBadge
            :color="STATUS_COLORS[l.status] as any"
            variant="subtle"
            size="sm"
          >
            {{ $t(`admin.leads.status.${l.status}`) }}
          </UBadge>
          <div class="ms-auto flex items-center gap-2">
            <UButton
              :href="mailtoHref(l)"
              :label="$t('admin.leads.reply')"
              icon="i-lucide-reply"
              color="primary"
              variant="soft"
              size="xs"
            />
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
      </div>
    </UCard>
  </UContainer>
</template>
