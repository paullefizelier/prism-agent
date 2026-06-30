<script setup lang="ts">
// Renders the contactRequest tool result: a confirmation (or failure) card.
defineProps<{ data: { ok: boolean; reason?: string; name?: string } }>();
</script>

<template>
  <div
    class="my-2 flex items-start gap-3 rounded-lg border p-4 max-w-md"
    :class="
      data.ok
        ? 'border-success/30 bg-success/5'
        : 'border-default bg-elevated/40'
    "
  >
    <UIcon
      :name="data.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
      class="size-5 shrink-0 mt-0.5"
      :class="data.ok ? 'text-success' : 'text-muted'"
    />
    <div class="min-w-0 text-sm">
      <p class="font-medium">
        {{ data.ok ? $t("tools.contactSent") : $t("tools.contactError") }}
      </p>
      <p v-if="data.ok" class="mt-0.5 text-muted">
        {{ $t("tools.contactNote") }}
      </p>
    </div>
  </div>
</template>
