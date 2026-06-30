<script setup lang="ts">
import { computed, ref } from 'vue'

definePageMeta({ middleware: 'admin' })

interface ProductRow {
  woo_id: number
  name: string
  categories: string[]
  price: string
  in_stock: boolean
  on_sale: boolean
  embedded: boolean
  updated_at: string
}

const { t } = useI18n()
const toast = useToast()

const { data: products, refresh, status } = await useFetch<ProductRow[]>(
  '/api/admin/products'
)

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = products.value ?? []
  return q ? list.filter(p => p.name.toLowerCase().includes(q)) : list
})

// `null` = no global action running; otherwise the running action name.
const globalBusy = ref<'sync' | 'reembed' | null>(null)
// woo_id of the row currently being acted on (one at a time is fine here).
const rowBusy = ref<number | null>(null)

async function runGlobal(action: 'sync' | 'reembed') {
  if (globalBusy.value) return
  globalBusy.value = action
  try {
    const res = await $fetch<{
      total?: number
      embedded?: number
      count?: number
    }>('/api/admin/products', { method: 'POST', body: { action } })
    toast.add({
      icon: 'i-lucide-check',
      title:
        action === 'sync'
          ? t('admin.products.syncDone', {
              total: res.total ?? 0,
              embedded: res.embedded ?? 0
            })
          : t('admin.products.reembedDone', { count: res.count ?? 0 })
    })
    await refresh()
  } catch {
    toast.add({
      icon: 'i-lucide-triangle-alert',
      color: 'error',
      title: t('admin.products.error')
    })
  } finally {
    globalBusy.value = null
  }
}

async function runRow(wooId: number, action: 'sync' | 'reembed') {
  if (rowBusy.value) return
  rowBusy.value = wooId
  try {
    const res = await $fetch<{ found?: boolean }>(
      `/api/admin/products/${wooId}`,
      { method: 'POST', body: { action } }
    )
    if (res.found === false) {
      toast.add({
        icon: 'i-lucide-triangle-alert',
        color: 'warning',
        title: t('admin.products.notFound')
      })
    } else {
      toast.add({
        icon: 'i-lucide-check',
        title:
          action === 'sync'
            ? t('admin.products.productSynced')
            : t('admin.products.productReembedded')
      })
      await refresh()
    }
  } catch {
    toast.add({
      icon: 'i-lucide-triangle-alert',
      color: 'error',
      title: t('admin.products.error')
    })
  } finally {
    rowBusy.value = null
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-semibold">
          {{ $t("admin.products.title") }}
        </h1>
        <UButton
          to="/admin"
          :label="$t('admin.conversations')"
          icon="i-lucide-messages-square"
          color="neutral"
          variant="ghost"
          size="sm"
        />
      </div>
      <div class="flex items-center gap-2">
        <UButton
          :label="$t('admin.products.sync')"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="soft"
          :loading="globalBusy === 'sync'"
          :disabled="!!globalBusy"
          @click="runGlobal('sync')"
        />
        <UButton
          :label="$t('admin.products.reembed')"
          icon="i-lucide-sparkles"
          color="primary"
          variant="soft"
          :loading="globalBusy === 'reembed'"
          :disabled="!!globalBusy"
          @click="runGlobal('reembed')"
        />
      </div>
    </div>

    <UInput
      v-model="search"
      icon="i-lucide-search"
      placeholder="Filtrer…"
      class="w-full max-w-sm"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div
        v-if="status === 'pending'"
        class="p-6 text-center text-muted text-sm"
      >
        …
      </div>
      <p class="px-4 py-2 text-xs text-muted border-b border-default">
        {{ $t("admin.products.count", { count: filtered.length }) }}
      </p>
      <div
        v-for="p in filtered"
        :key="p.woo_id"
        class="flex items-center justify-between gap-4 px-4 py-3 border-b border-default last:border-0"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">
            {{ p.name }}
          </p>
          <p class="text-xs text-muted truncate">
            {{ p.categories.join(", ") }} · {{ p.price }} € ·
            {{ fmtDate(p.updated_at) }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UBadge
            :color="p.in_stock ? 'success' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ p.in_stock ? $t("product.inStock") : $t("product.outOfStock") }}
          </UBadge>
          <UBadge
            :color="p.embedded ? 'primary' : 'warning'"
            variant="subtle"
            size="sm"
          >
            {{
              p.embedded
                ? $t("admin.products.embedded")
                : $t("admin.products.notEmbedded")
            }}
          </UBadge>
          <UTooltip :text="$t('admin.products.resync')">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="rowBusy === p.woo_id"
              :disabled="rowBusy !== null"
              :aria-label="$t('admin.products.resync')"
              @click="runRow(p.woo_id, 'sync')"
            />
          </UTooltip>
          <UTooltip :text="$t('admin.products.reembedOne')">
            <UButton
              icon="i-lucide-sparkles"
              color="primary"
              variant="ghost"
              size="sm"
              :disabled="rowBusy !== null"
              :aria-label="$t('admin.products.reembedOne')"
              @click="runRow(p.woo_id, 'reembed')"
            />
          </UTooltip>
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
