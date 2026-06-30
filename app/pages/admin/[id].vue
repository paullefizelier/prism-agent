<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface Board {
  id: number
  name: string
  url: string
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
              class="mt-1 text-xs"
            >
              <p class="text-muted mb-0.5">
                {{ $t("admin.recommendedBoards") }}
              </p>
              <ul class="space-y-0.5">
                <li
                  v-for="b in products(part)"
                  :key="b.id"
                >
                  <a
                    :href="b.url"
                    target="_blank"
                    class="underline"
                  >{{ b.name }}</a>
                </li>
              </ul>
            </div>
          </template>
        </div>
      </div>
    </div>
  </UContainer>
</template>
