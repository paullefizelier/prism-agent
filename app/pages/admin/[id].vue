<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface Board {
  id: number
  name: string
  url: string
  price?: string
  regularPrice?: string
  onSale?: boolean
  inStock?: boolean
  image?: string | null
}
interface ConvoMessage {
  role: string
  parts: Array<{
    type: string
    text?: string
    output?: { boards?: Board[] }
  }>
}
interface Convo {
  id: string
  created_at: string
  product_context: { name?: string } | null
  messages: ConvoMessage[]
}

const route = useRoute()
const { data: convo } = await useFetch<Convo>(
  `/api/admin/conversations/${route.params.id}`
)
function products(part: unknown): Board[] {
  return (part as { output?: { products?: Board[] } }).output?.products ?? []
}
</script>

<template>
  <UContainer class="py-8 space-y-4 max-w-3xl">
    <UButton
      to="/admin"
      :label="$t('admin.back')"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
    />

    <div
      v-if="convo"
      class="space-y-4"
    >
      <p class="text-xs text-muted">
        {{ new Date(convo.created_at).toLocaleString("fr-FR") }}
        <span v-if="convo.product_context?.name">
          ·
          {{
            $t("admin.consultedProduct", { name: convo.product_context.name })
          }}
        </span>
      </p>

      <div
        v-for="(m, mi) in convo.messages"
        :key="mi"
        class="flex"
        :class="m.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
          :class="m.role === 'user' ? 'bg-primary text-inverted' : 'bg-elevated'"
        >
          <template
            v-for="(part, pi) in m.parts"
            :key="pi"
          >
            <p
              v-if="part.type === 'text'"
              class="whitespace-pre-wrap"
            >
              {{ part.text }}
            </p>
            <div
              v-else-if="
                part.type === 'tool-recommendProducts' && products(part).length
              "
              class="mt-1.5 text-xs"
            >
              <p class="text-muted mb-1">
                {{ $t("admin.recommendedBoards") }}
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  v-for="b in products(part)"
                  :key="b.id"
                  :href="b.url"
                  target="_blank"
                  rel="noopener"
                  class="group flex gap-2 rounded-lg border border-default bg-default p-2 transition-shadow hover:shadow-md"
                >
                  <div
                    class="relative size-14 shrink-0 overflow-hidden rounded-md bg-elevated"
                  >
                    <img
                      v-if="b.image"
                      :src="b.image"
                      :alt="b.name"
                      class="absolute inset-0 size-full object-cover"
                      loading="lazy"
                    >
                    <UIcon
                      v-else
                      name="i-lucide-waves"
                      class="absolute inset-0 m-auto size-5 text-muted"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p
                      class="truncate font-medium text-default group-hover:text-primary"
                    >
                      {{ b.name }}
                    </p>
                    <div class="mt-0.5 flex items-baseline gap-1.5">
                      <span
                        v-if="b.price"
                        class="font-semibold text-default"
                      >{{ b.price }} €</span>
                      <span
                        v-if="b.onSale && b.regularPrice"
                        class="text-muted line-through"
                      >{{ b.regularPrice }} €</span>
                    </div>
                    <span
                      class="text-[11px]"
                      :class="
                        b.inStock === false ? 'text-muted' : 'text-success'
                      "
                    >
                      {{
                        b.inStock === false
                          ? $t("product.outOfStock")
                          : $t("product.inStock")
                      }}
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </UContainer>
</template>
