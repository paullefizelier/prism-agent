<script setup lang="ts">
// Renders the completeTheKit tool result: a sizing checklist (leash / wax / bag)
// plus compact accessory product cards.
import { computed } from "vue";

interface KitProduct {
  id: number;
  name: string;
  url: string;
  image: string | null;
  price: string;
  regularPrice: string;
  onSale: boolean;
  inStock: boolean;
}

const props = defineProps<{
  data: {
    guidance: {
      leashLength: number | null;
      waxTemp: string | null;
      bagLength: number | null;
    };
    products: KitProduct[];
  };
}>();

const hasGuidance = computed(() => {
  const g = props.data.guidance;
  return Boolean(g?.leashLength || g?.waxTemp || g?.bagLength);
});
</script>

<template>
  <div class="my-2 rounded-lg border border-default p-4">
    <div class="flex items-center gap-2 text-sm font-medium">
      <UIcon name="i-lucide-package-check" class="size-4 text-primary" />
      {{ $t("tools.kitHeading") }}
    </div>

    <div v-if="hasGuidance" class="mt-2 flex flex-wrap gap-1.5">
      <UBadge v-if="data.guidance.leashLength" color="neutral" variant="soft">
        🪢 {{ $t("tools.kitLeash") }} {{ data.guidance.leashLength }}'
      </UBadge>
      <UBadge v-if="data.guidance.waxTemp" color="neutral" variant="soft">
        🕯️ {{ $t("tools.kitWax") }} {{ data.guidance.waxTemp }}
      </UBadge>
      <UBadge v-if="data.guidance.bagLength" color="neutral" variant="soft">
        🎒 {{ $t("tools.kitBag") }} {{ data.guidance.bagLength }}'
      </UBadge>
    </div>

    <div
      v-if="data.products?.length"
      class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
    >
      <NuxtLink
        v-for="a in data.products"
        :key="a.id"
        :to="a.url"
        target="_blank"
        rel="noopener"
        class="group flex items-center gap-2 rounded-md border border-default p-2 transition-colors hover:bg-elevated/60"
      >
        <div
          class="relative size-12 shrink-0 overflow-hidden rounded bg-elevated"
        >
          <NuxtImg
            v-if="a.image"
            :src="a.image"
            :alt="a.name"
            class="absolute inset-0 size-full object-cover"
            format="webp"
            width="96"
            height="96"
            sizes="48px"
            loading="lazy"
          />
          <UIcon
            v-else
            name="i-lucide-package"
            class="absolute inset-0 m-auto size-5 text-muted"
          />
        </div>
        <div class="min-w-0">
          <p
            class="line-clamp-2 text-xs font-medium group-hover:text-primary"
          >
            {{ a.name }}
          </p>
          <p class="text-xs">
            <span class="font-semibold">{{ a.price }} €</span>
            <span
              v-if="a.onSale && a.regularPrice"
              class="ml-1 text-muted line-through"
            >
              {{ a.regularPrice }} €
            </span>
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
