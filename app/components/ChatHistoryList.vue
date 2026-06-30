<script setup lang="ts">
// List of saved conversations. Rendered both in the full-screen sidebar and
// inside the iframe slideover — emits `select` so the slideover can close after
// the user picks (the sidebar ignores it).
const emit = defineEmits<{ select: [] }>();

const { conversations, activeId, startNew, select, remove } = useChatHistory();

function onNew() {
  startNew();
  emit("select");
}

function onSelect(id: string) {
  select(id);
  emit("select");
}
</script>

<template>
  <div class="flex flex-col h-full gap-3 min-h-0">
    <UButton
      icon="i-lucide-square-pen"
      :label="$t('history.new')"
      color="neutral"
      variant="soft"
      block
      @click="onNew"
    />

    <div class="flex-1 overflow-y-auto -mx-1 px-1 min-h-0">
      <p
        v-if="!conversations.length"
        class="text-sm text-muted text-center py-8"
      >
        {{ $t("history.empty") }}
      </p>

      <ul v-else class="space-y-1">
        <li v-for="c in conversations" :key="c.id" class="group/item relative">
          <button
            type="button"
            class="w-full text-left rounded-md px-2.5 py-2 pr-9 text-sm transition-colors truncate"
            :class="
              c.id === activeId
                ? 'bg-elevated text-highlighted font-medium'
                : 'text-default hover:bg-elevated/60'
            "
            :title="c.title"
            @click="onSelect(c.id)"
          >
            {{ c.title }}
          </button>
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="xs"
            class="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 focus:opacity-100"
            :aria-label="$t('history.delete', { title: c.title })"
            @click="remove(c.id)"
          />
        </li>
      </ul>
    </div>
  </div>
</template>
