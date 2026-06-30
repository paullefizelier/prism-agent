<script setup lang="ts">
definePageMeta({ middleware: "admin" });

interface CustomShapeRequest {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  details: string;
  product_context: { name?: string } | null;
  conversation_id: string | null;
}

const { data: requests } = await useFetch<CustomShapeRequest[]>(
  "/api/admin/custom-shapes",
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
      <h1 class="text-xl font-semibold">
        {{ $t("admin.customShapes.title") }}
      </h1>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div
        v-if="!requests?.length"
        class="p-6 text-center text-muted text-sm"
      >
        {{ $t("admin.customShapes.none") }}
      </div>
      <div
        v-for="r in requests"
        :key="r.id"
        class="flex flex-col gap-2 px-4 py-3 border-b border-default last:border-0"
      >
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div class="min-w-0">
            <p class="text-sm font-medium">{{ r.name }}</p>
            <p class="text-xs text-muted">
              <a :href="`mailto:${r.email}`" class="hover:text-primary">
                {{ r.email }}
              </a>
              <span v-if="r.phone">
                ·
                <a :href="`tel:${r.phone}`" class="hover:text-primary">
                  {{ r.phone }}
                </a>
              </span>
            </p>
          </div>
          <div class="flex items-center gap-3 shrink-0 text-xs text-muted">
            <span>{{ fmtDate(r.created_at) }}</span>
            <UButton
              v-if="r.conversation_id"
              :to="`/admin/${r.conversation_id}`"
              :label="$t('admin.customShapes.viewConversation')"
              icon="i-lucide-messages-square"
              color="neutral"
              variant="ghost"
              size="xs"
            />
          </div>
        </div>
        <p class="text-sm whitespace-pre-wrap">{{ r.details }}</p>
        <p v-if="r.product_context?.name" class="text-xs text-muted">
          {{ $t("admin.viewedProduct", { name: r.product_context.name }) }}
        </p>
      </div>
    </UCard>
  </UContainer>
</template>
