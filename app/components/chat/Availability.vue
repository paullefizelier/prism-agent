<script setup lang="ts">
// Renders the checkAvailability tool result: overall stock + per-size availability.
interface Availability {
  id: number;
  name: string;
  url: string;
  type: string;
  inStock: boolean;
  stockQuantity: number | null;
  variations: {
    id: number;
    label: string;
    inStock: boolean;
    stockQuantity: number | null;
  }[];
}

defineProps<{ data: { found: boolean; availability?: Availability } }>();
</script>

<template>
  <div
    v-if="data.found && data.availability"
    class="my-2 rounded-lg border border-default p-4 max-w-md"
  >
    <div class="flex items-center justify-between gap-2">
      <NuxtLink
        :to="data.availability.url"
        target="_blank"
        rel="noopener"
        class="font-medium hover:text-primary"
      >
        {{ data.availability.name }}
      </NuxtLink>
      <UBadge
        :color="data.availability.inStock ? 'success' : 'neutral'"
        variant="soft"
        size="sm"
      >
        {{
          data.availability.inStock
            ? $t("product.inStock")
            : $t("product.outOfStock")
        }}
      </UBadge>
    </div>
    <p
      v-if="data.availability.inStock && data.availability.stockQuantity"
      class="mt-0.5 text-xs text-muted"
    >
      {{ $t("tools.unitsLeft", { count: data.availability.stockQuantity }) }}
    </p>

    <div v-if="data.availability.variations.length" class="mt-3">
      <p class="mb-1.5 text-xs font-medium text-muted">
        {{ $t("tools.sizesTitle") }}
      </p>
      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="v in data.availability.variations"
          :key="v.id"
          class="flex items-center gap-1.5 rounded-md border border-default px-2 py-1 text-xs"
          :class="v.inStock ? '' : 'opacity-50'"
        >
          <UIcon
            :name="v.inStock ? 'i-lucide-check' : 'i-lucide-x'"
            class="size-3.5 shrink-0"
            :class="v.inStock ? 'text-success' : 'text-muted'"
          />
          <span class="font-medium">{{ v.label }}</span>
          <span v-if="v.inStock && v.stockQuantity" class="text-muted">
            ({{ v.stockQuantity }})
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
