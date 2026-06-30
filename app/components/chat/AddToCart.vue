<script setup lang="ts">
// Renders the addToCart tool result: a one-tap confirmation card. The actual
// cart write happens in the visitor's browser (parent window) — SurfChat handles
// the postMessage when the user clicks, via the @add event.
import { ref } from "vue";

interface CartProduct {
  id: number;
  name: string;
  url: string;
  image: string | null;
  price: string;
}

const props = defineProps<{ data: { products: CartProduct[] } }>();
const emit = defineEmits<{ add: [CartProduct[]] }>();

const added = ref(false);
function onAdd() {
  if (added.value || !props.data.products?.length) return;
  emit("add", props.data.products);
  added.value = true;
}
</script>

<template>
  <div
    v-if="data.products?.length"
    class="my-2 rounded-lg border border-default p-3 max-w-sm"
  >
    <div class="mb-2 flex items-center gap-2 text-sm font-medium">
      <UIcon name="i-lucide-shopping-cart" class="size-4 text-primary" />
      {{ added ? $t("product.addedToCart") : $t("product.addToCartQuestion") }}
    </div>

    <ul class="mb-3 space-y-1.5">
      <li
        v-for="p in data.products"
        :key="p.id"
        class="flex items-center gap-2 text-sm"
      >
        <div
          class="relative size-9 shrink-0 overflow-hidden rounded bg-elevated"
        >
          <NuxtImg
            v-if="p.image"
            :src="p.image"
            :alt="p.name"
            class="absolute inset-0 size-full object-cover"
            format="webp"
            width="72"
            height="72"
            sizes="36px"
            loading="lazy"
          />
        </div>
        <span class="flex-1 truncate">{{ p.name }}</span>
        <span class="text-muted">{{ p.price }} €</span>
      </li>
    </ul>

    <UButton
      v-if="!added"
      :label="$t('product.addToCart')"
      icon="i-lucide-shopping-cart"
      color="primary"
      block
      @click="onAdd"
    />
    <div v-else class="flex items-center gap-1 text-xs text-success">
      <UIcon name="i-lucide-check" class="size-4" />
      {{ $t("product.addedToCart") }}
    </div>
  </div>
</template>
