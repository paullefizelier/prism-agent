<script setup lang="ts">
// Renders the getProductDetails tool result: a single product deep-dive card.
interface DetailProduct {
  id: number;
  name: string;
  url: string;
  image: string | null;
  price: string;
  regularPrice: string;
  onSale: boolean;
  inStock: boolean;
  summary: string;
  categories: string[];
  specs: { label: string; value: string }[];
}

defineProps<{ data: { found: boolean; product?: DetailProduct } }>();
</script>

<template>
  <div
    v-if="data.found && data.product"
    class="my-2 flex flex-col overflow-hidden rounded-lg border border-default sm:flex-row"
  >
    <div class="relative aspect-square shrink-0 bg-elevated sm:w-40">
      <NuxtImg
        v-if="data.product.image"
        :src="data.product.image"
        :alt="data.product.name"
        class="absolute inset-0 size-full object-cover"
        format="webp"
        width="320"
        height="320"
        sizes="(max-width: 640px) 100vw, 320px"
        loading="lazy"
      />
      <UIcon
        v-else
        name="i-lucide-waves"
        class="absolute inset-0 m-auto size-8 text-muted"
      />
      <UBadge
        v-if="data.product.onSale"
        color="error"
        variant="solid"
        size="sm"
        class="absolute left-2 top-2"
      >
        {{ $t("product.sale") }}
      </UBadge>
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-2 p-4">
      <div>
        <p class="font-semibold leading-tight">{{ data.product.name }}</p>
        <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span class="text-base font-semibold">{{ data.product.price }} €</span>
          <span
            v-if="data.product.onSale && data.product.regularPrice"
            class="text-sm text-muted line-through"
          >
            {{ data.product.regularPrice }} €
          </span>
          <span
            class="text-xs font-medium"
            :class="data.product.inStock ? 'text-success' : 'text-muted'"
          >
            {{
              data.product.inStock
                ? $t("product.inStock")
                : $t("product.outOfStock")
            }}
          </span>
        </div>
      </div>

      <p v-if="data.product.summary" class="line-clamp-3 text-sm text-muted">
        {{ data.product.summary }}
      </p>

      <dl
        v-if="data.product.specs?.length"
        class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"
      >
        <template v-for="s in data.product.specs" :key="s.label">
          <dt class="truncate text-muted">{{ s.label }}</dt>
          <dd class="truncate text-default">{{ s.value }}</dd>
        </template>
      </dl>

      <UButton
        :to="data.product.url"
        target="_blank"
        rel="noopener"
        icon="i-lucide-arrow-up-right"
        :label="$t('product.view')"
        color="primary"
        variant="solid"
        size="sm"
        class="mt-auto self-start"
      />
    </div>
  </div>
</template>
