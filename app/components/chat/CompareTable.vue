<script setup lang="ts">
// Renders the compareProducts tool result: a side-by-side spec table.
interface CompareProduct {
  id: number;
  name: string;
  url: string;
  image: string | null;
  price: string;
  regularPrice: string;
  onSale: boolean;
  inStock: boolean;
}

defineProps<{
  data: {
    products: CompareProduct[];
    specs: { label: string; values: (string | null)[] }[];
  };
}>();
</script>

<template>
  <div v-if="data.products?.length" class="my-2 -mx-1 overflow-x-auto">
    <table class="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th class="w-24 p-2"></th>
          <th
            v-for="p in data.products"
            :key="p.id"
            class="min-w-36 p-2 align-bottom text-left font-normal"
          >
            <NuxtLink
              :to="p.url"
              target="_blank"
              rel="noopener"
              class="group block"
            >
              <div
                class="relative mb-2 aspect-square w-full overflow-hidden rounded-md bg-elevated"
              >
                <NuxtImg
                  v-if="p.image"
                  :src="p.image"
                  :alt="p.name"
                  class="absolute inset-0 size-full object-cover"
                  format="webp"
                  width="200"
                  height="200"
                  sizes="200px"
                  loading="lazy"
                />
                <UIcon
                  v-else
                  name="i-lucide-waves"
                  class="absolute inset-0 m-auto size-6 text-muted"
                />
              </div>
              <span
                class="line-clamp-2 font-medium text-default group-hover:text-primary"
              >
                {{ p.name }}
              </span>
              <span class="mt-1 flex items-baseline gap-1.5">
                <span class="font-semibold">{{ p.price }} €</span>
                <span
                  v-if="p.onSale && p.regularPrice"
                  class="text-xs text-muted line-through"
                >
                  {{ p.regularPrice }} €
                </span>
              </span>
              <span
                class="block text-xs font-medium"
                :class="p.inStock ? 'text-success' : 'text-muted'"
              >
                {{ p.inStock ? $t("product.inStock") : $t("product.outOfStock") }}
              </span>
            </NuxtLink>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in data.specs"
          :key="row.label"
          class="border-t border-default"
        >
          <th class="p-2 text-left align-top font-medium text-muted">
            {{ row.label }}
          </th>
          <td
            v-for="(v, i) in row.values"
            :key="i"
            class="p-2 align-top text-default"
          >
            {{ v ?? "—" }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
