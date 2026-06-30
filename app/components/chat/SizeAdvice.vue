<script setup lang="ts">
// Renders the sizeAdvisor tool result: the recommended board volume range.
defineProps<{
  data: {
    weightKg: number;
    level: string;
    waveType: string;
    volumeMin: number;
    volumeMax: number;
  };
}>();
</script>

<template>
  <div class="my-2 rounded-lg border border-default bg-elevated/40 p-4 max-w-xs">
    <div class="flex items-center gap-2 text-sm font-medium text-muted">
      <UIcon name="i-lucide-gauge" class="size-4 text-primary" />
      {{ $t("tools.sizeHeading") }}
    </div>
    <div class="mt-2 flex items-baseline gap-1.5">
      <span class="text-3xl font-semibold text-highlighted tabular-nums">
        {{ data.volumeMin }}–{{ data.volumeMax }}
      </span>
      <span class="text-lg text-muted">L</span>
    </div>
    <p class="mt-1 text-xs text-muted">
      {{ $t("tools.sizeVolume") }} · {{ data.weightKg }} kg
    </p>
  </div>
</template>
