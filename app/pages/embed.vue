<script setup lang="ts">
import { useChat } from "@ai-sdk/vue";
import { computed, ref } from "vue";
import { isPartStreaming, isToolStreaming } from "@nuxt/ui/utils/ai";

definePageMeta({ layout: "embed" });

interface BoardCard {
  id: number;
  name: string;
  url: string;
  price: string;
  regularPrice: string;
  onSale: boolean;
  inStock: boolean;
  summary: string;
  image: string | null;
}

// Product the visitor is viewing, passed by the widget loader via the iframe URL.
const route = useRoute();
const productContext = computed(() => {
  const id = Number(route.query.productId);
  const name =
    typeof route.query.productName === "string"
      ? route.query.productName
      : undefined;
  if (!name && !id) return undefined;
  return { id: Number.isFinite(id) ? id : undefined, name };
});

const { messages, sendMessage, status, stop, regenerate } = useChat();

const input = ref("");

const suggestions = [
  "Je débute, quelle planche choisir ?",
  "Quelle taille pour 75 kg en vagues molles ?",
  "Une planche performance pour rider confirmé ?",
];

function send(text: string) {
  const value = text.trim();
  if (!value || status.value === "submitted" || status.value === "streaming")
    return;
  sendMessage(
    { text: value },
    { body: { productContext: productContext.value } },
  );
  input.value = "";
}

function boardsFromPart(part: unknown): BoardCard[] {
  return (part as { output?: { boards?: BoardCard[] } }).output?.boards ?? [];
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <header
      class="flex items-center gap-3 px-4 py-3 border-b border-default shrink-0"
    >
      <UIcon name="i-lucide-waves" class="size-6 text-primary" />
      <div>
        <p class="font-semibold leading-tight">Prism Surf Advisor</p>
        <p class="text-xs text-muted leading-tight">
          Conseiller IA • choix de planche
        </p>
      </div>
    </header>

    <!-- Empty state -->
    <div
      v-if="messages.length === 0"
      class="flex-1 flex flex-col items-center justify-center text-center gap-4 px-4"
    >
      <UIcon name="i-lucide-waves" class="size-10 text-primary" />
      <div>
        <p class="font-medium">
          Salut ! 🤙 Je t'aide à trouver ta planche idéale.
        </p>
        <p class="text-sm text-muted mt-1">
          Dis-moi ton niveau, ton gabarit et le type de vagues que tu surfes.
        </p>
      </div>
      <div class="flex flex-col gap-2 w-full max-w-sm">
        <UButton
          v-for="s in suggestions"
          :key="s"
          :label="s"
          color="neutral"
          variant="soft"
          block
          @click="send(s)"
        />
      </div>
    </div>

    <!-- Conversation -->
    <UChatMessages
      v-else
      :messages="messages"
      :status="status"
      should-auto-scroll
      class="flex-1 overflow-y-auto px-4 py-4"
      :assistant="{ avatar: { icon: 'i-lucide-waves' } }"
      :user="{ side: 'right', variant: 'soft' }"
    >
      <template #content="{ parts, role }">
        <template v-for="(part, index) in parts" :key="index">
          <!-- Reasoning (if the model emits any) -->
          <UChatReasoning
            v-if="part.type === 'reasoning'"
            :text="part.text"
            :streaming="isPartStreaming(part)"
            class="mb-2"
          />

          <!-- Text: markdown for the assistant, plain for the user -->
          <template v-else-if="part.type === 'text'">
            <ChatComark
              v-if="role === 'assistant'"
              :markdown="part.text"
              :streaming="isPartStreaming(part)"
            />
            <p v-else class="whitespace-pre-wrap">
              {{ part.text }}
            </p>
          </template>

          <!-- Catalog search: discreet indicator while running, then product cards -->
          <template v-else-if="part.type === 'tool-searchBoards'">
            <!-- Searching -->
            <div
              v-if="isToolStreaming(part)"
              class="flex items-center gap-2 my-1 text-sm text-muted"
            >
              <UIcon
                name="i-lucide-loader-circle"
                class="size-4 animate-spin shrink-0"
              />
              <UChatShimmer text="Je parcours le catalogue Prism…" />
            </div>

            <!-- Results -->
            <div v-else class="my-2 space-y-2">
              <p
                v-if="boardsFromPart(part).length === 0"
                class="text-sm text-muted italic"
              >
                Aucune planche ne correspond pour l'instant — affinons ta
                recherche.
              </p>
              <div
                v-else
                class="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              >
                <UBlogPost
                  v-for="board in boardsFromPart(part)"
                  :key="board.id"
                  :to="board.url"
                  :title="board.name"
                  :description="board.summary"
                  :image="board.image ?? undefined"
                  target="_blank"
                  rel="noopener"
                  :ui="{
                    header: 'aspect-square',
                    root: 'flex flex-col justify-between',
                    footer:
                      'flex items-center gap-2 p-4 sm:p-6 border-t border-default justify-between',
                    body: 'flex-1',
                  }"
                >
                  <template #header>
                    <div class="relative aspect-square bg-elevated">
                      <NuxtImg
                        v-if="board.image"
                        :src="board.image"
                        :alt="board.name"
                        class="absolute inset-0 size-full object-cover"
                        format="webp"
                        width="100"
                        height="100"
                        quality="80"
                        loading="lazy"
                        fetchpriority="high"
                        decoding="async"
                      />
                      <UIcon
                        v-else
                        name="i-lucide-waves"
                        class="absolute inset-0 m-auto size-8 text-muted"
                      />
                      <UBadge
                        v-if="board.onSale"
                        color="error"
                        variant="solid"
                        size="sm"
                        class="absolute top-2 left-2"
                      >
                        Promo
                      </UBadge>
                    </div>
                  </template>
                  <!-- <div class="flex flex-col gap-1.5 p-3">
                    <p
                      class="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary"
                    >
                      {{ board.name }}
                    </p>
                    <div class="flex items-center justify-between mt-auto pt-1">
                      <span class="font-semibold">{{ board.price }} €</span>
                      <span
                        class="text-xs font-medium"
                        :class="board.inStock ? 'text-success' : 'text-muted'"
                      >
                        {{ board.inStock ? "En stock" : "Épuisé" }}
                      </span>
                    </div>
                    <span
                      class="inline-flex items-center gap-1 text-xs font-medium text-primary"
                    >
                      Voir le produit
                      <UIcon
                        name="i-lucide-arrow-up-right"
                        class="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      />
                    </span>
                  </div> -->
                  <template #footer>
                    <div class="flex flex-col">
                      <div class="flex items-baseline gap-2">
                        <span class="font-semibold text-base">
                          {{ board.price }} €
                        </span>
                        <span
                          v-if="board.onSale && board.regularPrice"
                          class="text-sm text-muted line-through"
                        >
                          {{ board.regularPrice }} €
                        </span>
                      </div>
                      <span
                        class="text-xs font-medium"
                        :class="board.inStock ? 'text-success' : 'text-muted'"
                      >
                        {{ board.inStock ? "En stock" : "Épuisé" }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <UButton
                        icon="i-lucide-arrow-up-right"
                        color="primary"
                        variant="solid"
                        size="sm"
                      >
                        Voir le produit
                      </UButton>
                    </div>
                  </template>
                </UBlogPost>
              </div>
            </div>
          </template>

          <!-- Single board detail lookup: only a discreet indicator while loading -->
          <div
            v-else-if="
              part.type === 'tool-getBoardDetails' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer text="Je consulte la fiche détaillée…" />
          </div>
        </template>
      </template>

      <template #indicator>
        <UChatShimmer text="Le shaper réfléchit…" />
      </template>
    </UChatMessages>

    <!-- Input -->
    <footer class="border-t border-default p-3 shrink-0">
      <UChatPrompt
        v-model="input"
        placeholder="Pose ta question..."
        variant="soft"
        @submit="send(input)"
        @close="stop"
      >
        <UChatPromptSubmit
          :status="status"
          color="primary"
          @stop="() => stop()"
          @reload="() => regenerate()"
        />
      </UChatPrompt>
    </footer>
  </div>
</template>
