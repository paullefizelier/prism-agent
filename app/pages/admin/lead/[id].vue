<script setup lang="ts">
import { computed } from "vue";

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
interface ConversationSummary {
  id: string;
  created_at: string;
  preview: string | null;
  message_count: number;
  recommended_woo_ids: number[] | null;
}

const route = useRoute();
const { t } = useI18n();
const toast = useToast();

const { data, refresh } = await useFetch<{
  lead: Lead;
  conversation: ConversationSummary | null;
}>(`/api/admin/leads/${route.params.id}`);

const lead = computed(() => data.value?.lead);
const conversation = computed(() => data.value?.conversation);

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

async function setStatus(status: Status) {
  if (!lead.value || lead.value.status === status) return;
  try {
    await $fetch(`/api/admin/leads/${lead.value.id}`, {
      method: "POST",
      body: { status },
    });
    await refresh();
    toast.add({ icon: "i-lucide-check", title: t("admin.leads.statusUpdated") });
  } catch {
    toast.add({
      icon: "i-lucide-triangle-alert",
      color: "error",
      title: t("admin.leads.error"),
    });
  }
}

const mailtoHref = computed(() => {
  if (!lead.value) return "#";
  const subject = t("admin.leads.replySubject");
  const body = `${t("admin.leads.replyBody", { name: lead.value.name })}\n\n> ${lead.value.message.replace(/\n/g, "\n> ")}`;
  return `mailto:${lead.value.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

function fmtDate(d: string) {
  return new Date(d).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
  toast.add({ icon: "i-lucide-check", title: t("common.copied") });
}
</script>

<template>
  <UContainer class="py-8 space-y-6 max-w-3xl">
    <div class="flex items-center gap-3">
      <UButton
        to="/admin/leads"
        :label="$t('admin.leads.title')"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
      />
    </div>

    <template v-if="lead">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <UBadge
              :color="(REASON_COLORS[lead.reason] as any)"
              variant="subtle"
            >
              {{ $t(`admin.leads.reason.${lead.reason}`) }}
            </UBadge>
            <h1 class="text-xl font-semibold">{{ lead.name }}</h1>
          </div>
          <p class="text-xs text-muted">{{ fmtDate(lead.created_at) }}</p>
        </div>
        <UButton
          :href="mailtoHref"
          :label="$t('admin.leads.reply')"
          icon="i-lucide-reply"
          color="primary"
        />
      </div>

      <!-- Contact + status -->
      <UCard>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">
              {{ $t("admin.leads.contact") }}
            </p>
            <div class="flex items-center gap-1.5 text-sm">
              <UIcon name="i-lucide-mail" class="size-4 text-muted shrink-0" />
              <a :href="`mailto:${lead.email}`" class="hover:text-primary">{{
                lead.email
              }}</a>
              <UButton
                icon="i-lucide-copy"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="$t('common.copy')"
                @click="copy(lead.email)"
              />
            </div>
            <div
              v-if="lead.phone"
              class="flex items-center gap-1.5 text-sm"
            >
              <UIcon name="i-lucide-phone" class="size-4 text-muted shrink-0" />
              <a :href="`tel:${lead.phone}`" class="hover:text-primary">{{
                lead.phone
              }}</a>
            </div>
          </div>
          <div class="space-y-2">
            <p class="text-xs font-medium text-muted uppercase tracking-wide">
              {{ $t("admin.leads.statusLabel") }}
            </p>
            <div class="flex items-center gap-2">
              <USelectMenu
                :model-value="lead.status"
                :items="statusItems"
                value-key="value"
                icon="i-lucide-circle-dot"
                class="w-44"
                @update:model-value="(v: any) => setStatus(v as Status)"
              />
              <UBadge
                :color="(STATUS_COLORS[lead.status] as any)"
                variant="subtle"
              >
                {{ $t(`admin.leads.status.${lead.status}`) }}
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Request -->
      <UCard>
        <template #header>
          <p class="font-medium">{{ $t("admin.leads.requestDetail") }}</p>
        </template>
        <p class="text-sm whitespace-pre-wrap">{{ lead.message }}</p>
        <p v-if="lead.product_context?.name" class="mt-3 text-xs text-muted">
          {{ $t("admin.viewedProduct", { name: lead.product_context.name }) }}
        </p>
      </UCard>

      <!-- Linked conversation -->
      <UCard v-if="conversation">
        <template #header>
          <p class="font-medium">{{ $t("admin.leads.conversation") }}</p>
        </template>
        <p class="text-sm text-muted italic">
          “{{ conversation.preview || $t("admin.noPreview") }}”
        </p>
        <div class="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3 text-xs text-muted">
            <span>{{
              $t("admin.messagesCount", { count: conversation.message_count })
            }}</span>
            <UBadge
              v-if="conversation.recommended_woo_ids?.length"
              color="primary"
              variant="subtle"
              size="sm"
            >
              {{
                $t("admin.recoCount", {
                  count: conversation.recommended_woo_ids.length,
                })
              }}
            </UBadge>
          </div>
          <UButton
            :to="`/admin/${conversation.id}`"
            :label="$t('admin.leads.viewConversation')"
            icon="i-lucide-messages-square"
            color="neutral"
            variant="soft"
            size="sm"
          />
        </div>
      </UCard>
    </template>
  </UContainer>
</template>
