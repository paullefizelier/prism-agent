<script setup lang="ts">
import { useChat } from "@ai-sdk/vue";
import type { UIMessage } from "ai";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isPartStreaming, isToolStreaming } from "@nuxt/ui/utils/ai";

// Shared chat UI used both full-screen (/) and embedded in an iframe (/embed).
// `embedded` toggles the iframe-only affordances: an in-header history button
// that opens a slideover (the full-screen page uses a permanent sidebar instead).
const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false,
});

// Link targets: full-screen opens in a new tab; embedded navigates the parent
// window (_top) so product links go to the product page instead of opening a tab.
useHead({ base: { target: props.embedded ? "_top" : "_blank" } });

const { t, locale, setLocale } = useI18n();

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

// Page the visitor is on, passed by the widget loader via the iframe URL:
// a product page (id + name) or a category page (name + slug).
const route = useRoute();
const productContext = computed(() => {
  const q = route.query;
  if (q.ctxType === "category") {
    const categoryName =
      typeof q.categoryName === "string" ? q.categoryName : undefined;
    const categorySlug =
      typeof q.categorySlug === "string" ? q.categorySlug : undefined;
    if (!categoryName && !categorySlug) return undefined;
    return { type: "category" as const, categoryName, categorySlug };
  }
  const id = Number(q.productId);
  const name = typeof q.productName === "string" ? q.productName : undefined;
  if (!name && !id) return undefined;
  return {
    type: "product" as const,
    id: Number.isFinite(id) ? id : undefined,
    name,
  };
});

const { messages, sendMessage, status, stop, regenerate, error, clearError } =
  useChat();

const input = ref("");
const toast = useToast();
const history = useChatHistory();
const router = useRouter();
const historyOpen = ref(false);

// Stable id per conversation; mirrors the active history entry so server-side
// logging and the stored conversation share the same id.
const conversationId = ref<string>();

const suggestions = computed(() => [
  t("chat.suggestions.beginner"),
  t("chat.suggestions.size"),
  t("chat.suggestions.performance"),
]);

const isBusy = computed(
  () => status.value === "submitted" || status.value === "streaming",
);

// Guards the messages reset triggered by switching `activeId` so it never wipes
// a brand-new conversation the moment its first message is being sent.
let restoring = false;

async function loadConversation(id: string | null) {
  restoring = true;
  // Transcripts live on the server now — fetch on demand (scoped by visitorId).
  messages.value = id ? await history.fetchMessages(id) : [];
  conversationId.value = id ?? undefined;
  if (error.value) clearError();
  await nextTick();
  restoring = false;
}

onMounted(async () => {
  // Open in the page's language when the widget loader passes ?lang=.
  const lang = route.query.lang;
  if ((lang === "fr" || lang === "en") && lang !== locale.value) setLocale(lang);

  await history.load();
  // Deep-link: restore the conversation named in ?c=<id> if it's the visitor's.
  const c = typeof route.query.c === "string" ? route.query.c : undefined;
  if (c && history.conversations.value.some((conv) => conv.id === c)) {
    history.select(c);
  }
});

// React to selections made from the sidebar / slideover list.
watch(
  () => history.activeId.value,
  (id) => {
    if (restoring) return;
    loadConversation(id);
  },
);

// Keep the active conversation id in the URL (?c=) so a conversation is
// shareable, bookmarkable and survives a reload. Kept separate from the loader
// watcher so the URL tracks activeId even during a guarded (restoring) switch.
watch(
  () => history.activeId.value,
  (id) => {
    const current =
      typeof route.query.c === "string" ? route.query.c : undefined;
    if (current === (id ?? undefined)) return;
    const query = { ...route.query };
    if (id) query.c = id;
    else delete query.c;
    router.replace({ path: route.path, query, hash: route.hash });
  },
);

// Persist once the assistant settles (or errors) so both the question and the
// answer are saved — including failed exchanges the user may want to retry.
watch(
  () => status.value,
  (s) => {
    if (restoring) return;
    if ((s === "ready" || s === "error") && messages.value.length) {
      // Server already persisted the transcript; just reflect it in the list.
      history.noteActive(messages.value as UIMessage[]);
    }
  },
);

function send(text: string) {
  const value = text.trim();
  if (!value || isBusy.value) return;
  if (!history.activeId.value) {
    // New conversation started implicitly by typing: claim an id without
    // letting the activeId watcher clear the message we're about to send.
    restoring = true;
    history.startNew();
    nextTick(() => {
      restoring = false;
    });
  }
  conversationId.value = history.activeId.value ?? undefined;
  sendMessage(
    { text: value },
    {
      body: {
        productContext: productContext.value,
        conversationId: conversationId.value,
        locale: locale.value,
        visitorId: history.ensureVisitorId(),
      },
    },
  );
  input.value = "";
}

function newConversation() {
  if (isBusy.value) stop();
  history.startNew();
}

function messageText(message: { parts?: UIMessage["parts"] }): string {
  return (message.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n\n");
}

// Per-message actions shown on hover (native UChatMessage `actions`). onClick
// receives the message, so copy/regenerate can target that specific reply.
const assistantActions = computed(() => [
  {
    label: t("common.copy"),
    icon: "i-lucide-copy",
    onClick: async (_e: Event, message: { parts?: UIMessage["parts"] }) => {
      await navigator.clipboard.writeText(messageText(message));
      toast.add({ title: t("chat.copied"), icon: "i-lucide-check" });
    },
  },
  {
    label: t("common.regenerate"),
    icon: "i-lucide-refresh-cw",
    onClick: (_e: Event, message: { id: string }) =>
      regenerate({ messageId: message.id }),
  },
]);

function productsFromPart(part: unknown): BoardCard[] {
  return (
    (part as { output?: { products?: BoardCard[] } }).output?.products ?? []
  );
}

function cartUrl(board: BoardCard): string {
  try {
    const origin = new URL(board.url).origin;
    const prefix = locale.value === "en" ? "/en" : "";
    return `${origin}${prefix}/panier/?add-to-cart=${board.id}`;
  } catch {
    return board.url;
  }
}
// Embedded: navigate the host (WC) tab so the visitor's real session is used.
// Full-screen app: open in a new tab so the chat stays put.
function openUrl(url: string) {
  if (props.embedded) (window.top ?? window).location.href = url;
  else window.open(url, "_blank");
}
function goToProduct(board: BoardCard) {
  openUrl(board.url);
}

// Add to cart. Embedded, the first-party loader.js holds the WooCommerce
// session, so we ask it (postMessage) to add over AJAX and stay in the chat;
// it replies with prism-add-to-cart-result (and navigates to the product page
// itself if the item needs options). Full-screen we just open the cart URL.
const addingId = ref<number>();
// Resolvers keyed by productId so a multi-add can wait for each item's result.
const cartResolvers = new Map<number, () => void>();

// Post one add-to-cart to the first-party bridge; resolves when it replies
// (prism-add-to-cart-result) or after a safety timeout. Full-screen: open the
// cart URL directly (no bridge).
function postAddToCart(board: BoardCard): Promise<void> {
  if (!props.embedded) {
    openUrl(cartUrl(board));
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let wcOrigin: string;
    try {
      wcOrigin = new URL(board.url).origin;
    } catch {
      openUrl(cartUrl(board));
      resolve();
      return;
    }
    const finish = () => {
      cartResolvers.delete(board.id);
      resolve();
    };
    cartResolvers.set(board.id, finish);
    window.parent.postMessage(
      { type: "prism-add-to-cart", productId: board.id, productUrl: board.url },
      wcOrigin,
    );
    window.setTimeout(finish, 8000);
  });
}

function addToCart(board: BoardCard) {
  addingId.value = board.id;
  void postAddToCart(board).finally(() => {
    if (addingId.value === board.id) addingId.value = undefined;
  });
}

// Agent-driven add (addToCart tool, after the visitor taps confirm). Sequential
// on purpose: firing the WooCommerce add_to_cart calls in parallel races on the
// cart session and only one item sticks — we wait for each before the next.
async function addProductsToCart(products: { id: number; url: string }[]) {
  for (const p of products) await postAddToCart(p as BoardCard);
}

function onCartMessage(e: MessageEvent) {
  const d = e.data as { type?: string; ok?: boolean; productId?: number };
  if (!d || d.type !== "prism-add-to-cart-result") return;
  if (addingId.value === d.productId) addingId.value = undefined;
  if (d.productId != null) cartResolvers.get(d.productId)?.();
  if (d.ok)
    toast.add({ title: t("product.addedToCart"), icon: "i-lucide-check" });
}
onMounted(() => window.addEventListener("message", onCartMessage));
onBeforeUnmount(() => window.removeEventListener("message", onCartMessage));

// Tool-result parts carry their payload under `output` once resolved; cast past
// the loose slot typing so the dedicated renderers receive it.
function partOutput(part: unknown): any {
  return (part as { output?: unknown }).output;
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <header
      class="flex items-center gap-3 px-4 py-3 border-b border-default shrink-0"
    >
      <UDashboardSidebarToggle v-if="!embedded" class="lg:hidden" />
      <NuxtImg
        src="/logo-prism-surfboards.png.webp"
        class="w-auto h-12 shrink-0"
        format="webp"
      />
      <div class="min-w-0">
        <p class="font-semibold leading-tight">{{ $t("chat.title") }}</p>
        <p class="text-xs text-muted leading-tight">
          {{ $t("chat.subtitle") }}
        </p>
      </div>

      <div class="ms-auto flex items-center gap-1">
        <UTooltip :text="$t('chat.switchLanguage')">
          <UButton
            :label="locale === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR'"
            color="neutral"
            variant="ghost"
            @click="setLocale(locale === 'fr' ? 'en' : 'fr')"
          />
        </UTooltip>
        <UTooltip :text="$t('history.new')">
          <UButton
            icon="i-lucide-square-pen"
            color="neutral"
            variant="ghost"
            :aria-label="$t('history.new')"
            @click="newConversation"
          />
        </UTooltip>
        <UTooltip v-if="embedded" :text="$t('chat.history')">
          <UButton
            icon="i-lucide-history"
            color="neutral"
            variant="ghost"
            :aria-label="$t('chat.history')"
            @click="historyOpen = true"
          />
        </UTooltip>
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
          {{ $t("chat.emptyTitle") }}
        </p>
        <p class="text-sm text-muted mt-1">
          {{ $t("chat.emptyHint") }}
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
      :assistant="{
        avatar: { icon: 'i-lucide-waves' },
        actions: assistantActions,
      }"
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

          <!-- Catalog search: discreet indicator only (candidates are not shown) -->
          <div
            v-else-if="
              part.type === 'tool-searchCatalog' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('chat.searching')" />
          </div>

          <!-- Recommended products: clickable cards -->
          <template
            v-else-if="
              part.type === 'tool-recommendProducts' && !isToolStreaming(part)
            "
          >
            <div
              v-if="productsFromPart(part).length"
              class="my-2 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            >
              <UBlogPost
                v-for="board in productsFromPart(part)"
                :key="board.id"
                :title="board.name"
                :description="board.summary"
                :image="board.image ?? undefined"
                class="cursor-pointer transition-shadow hover:shadow-lg"
                @click="goToProduct(board)"
                :ui="{
                  header: embedded ? 'aspect-video' : 'aspect-square',
                  root: 'flex flex-col justify-between',
                  footer: embedded
                    ? 'flex items-center gap-2 p-3 border-t border-default justify-between'
                    : 'flex items-center gap-2 p-4 sm:p-6 border-t border-default justify-between',
                  body: 'flex-1',
                }"
              >
                <template #header>
                  <div
                    class="relative bg-elevated"
                    :class="embedded ? 'aspect-video' : 'aspect-square'"
                  >
                    <NuxtImg
                      v-if="board.image"
                      :src="board.image"
                      :alt="board.name"
                      class="absolute inset-0 size-full object-cover"
                      format="webp"
                      width="400"
                      height="400"
                      sizes="(max-width: 640px) 100vw, 400px"
                      quality="80"
                      loading="lazy"
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
                      {{ $t("product.sale") }}
                    </UBadge>
                  </div>
                </template>
                <template #footer>
                  <div class="flex flex-col">
                    <div class="flex items-baseline gap-2">
                      <span
                        class="font-semibold"
                        :class="embedded ? 'text-sm' : 'text-base'"
                      >
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
                      {{
                        board.inStock
                          ? $t("product.inStock")
                          : $t("product.outOfStock")
                      }}
                    </span>
                  </div>
                  <div class="flex flex-col gap-1 shrink-0">
                    <UButton
                      v-if="board.inStock"
                      icon="i-lucide-shopping-cart"
                      color="primary"
                      variant="solid"
                      size="sm"
                      :loading="addingId === board.id"
                      :label="$t('product.addToCart')"
                      @click.stop.prevent="addToCart(board)"
                    />
                    <UButton
                      icon="i-lucide-arrow-up-right"
                      color="neutral"
                      :variant="board.inStock ? 'ghost' : 'solid'"
                      size="sm"
                      :label="$t('product.view')"
                    />
                  </div>
                </template>
              </UBlogPost>
            </div>
          </template>

          <!-- Size advisor: indicator while computing, then volume card -->
          <div
            v-else-if="
              part.type === 'tool-sizeAdvisor' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('tools.sizing')" />
          </div>
          <ChatSizeAdvice
            v-else-if="
              part.type === 'tool-sizeAdvisor' && !isToolStreaming(part)
            "
            :data="partOutput(part)"
          />

          <!-- Comparison: indicator while fetching, then side-by-side table -->
          <div
            v-else-if="
              part.type === 'tool-compareProducts' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('tools.comparing')" />
          </div>
          <ChatCompareTable
            v-else-if="
              part.type === 'tool-compareProducts' && !isToolStreaming(part)
            "
            :data="partOutput(part)"
          />

          <!-- Product detail: indicator while loading, then deep-dive card -->
          <div
            v-else-if="
              part.type === 'tool-getProductDetails' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('tools.loadingDetails')" />
          </div>
          <ChatProductDetail
            v-else-if="
              part.type === 'tool-getProductDetails' && !isToolStreaming(part)
            "
            :data="partOutput(part)"
          />

          <!-- Complete the kit: indicator while building, then accessory checklist -->
          <div
            v-else-if="
              part.type === 'tool-completeTheKit' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('tools.buildingKit')" />
          </div>
          <ChatKitChecklist
            v-else-if="
              part.type === 'tool-completeTheKit' && !isToolStreaming(part)
            "
            :data="partOutput(part)"
          />

          <!-- Availability: indicator while checking, then stock + sizes -->
          <div
            v-else-if="
              part.type === 'tool-checkAvailability' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('tools.checkingStock')" />
          </div>
          <ChatAvailability
            v-else-if="
              part.type === 'tool-checkAvailability' && !isToolStreaming(part)
            "
            :data="partOutput(part)"
          />

          <!-- Shop info: discreet indicator only (the answer is the model's prose) -->
          <div
            v-else-if="part.type === 'tool-shopInfo' && isToolStreaming(part)"
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('tools.checkingInfo')" />
          </div>

          <!-- Contact / handoff request: indicator while saving, then confirmation -->
          <div
            v-else-if="
              part.type === 'tool-contactRequest' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('tools.sendingRequest')" />
          </div>
          <ChatContactConfirm
            v-else-if="
              part.type === 'tool-contactRequest' && !isToolStreaming(part)
            "
            :data="partOutput(part)"
          />

          <!-- Add to cart: indicator while preparing, then one-tap confirm card -->
          <div
            v-else-if="
              part.type === 'tool-addToCart' && isToolStreaming(part)
            "
            class="flex items-center gap-2 my-1 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin shrink-0"
            />
            <UChatShimmer :text="$t('tools.preparingCart')" />
          </div>
          <ChatAddToCart
            v-else-if="
              part.type === 'tool-addToCart' && !isToolStreaming(part)
            "
            :data="partOutput(part)"
            @add="addProductsToCart"
          />
        </template>
      </template>

      <template #indicator>
        <UChatShimmer :text="$t('chat.thinking')" />
      </template>
    </UChatMessages>

    <!-- Error -->
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :title="$t('chat.errorTitle')"
      :description="$t('chat.errorDescription')"
      class="mx-3 mt-3 shrink-0"
      :actions="[
        {
          label: $t('common.retry'),
          color: 'error',
          variant: 'solid',
          onClick: () => {
            clearError();
            regenerate();
          },
        },
      ]"
    />

    <!-- Input -->
    <footer class="border-t border-default p-3 shrink-0">
      <UChatPrompt
        v-model="input"
        :placeholder="$t('chat.placeholder')"
        variant="soft"
        autofocus
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

    <!-- History slideover (iframe widget only) -->
    <USlideover
      v-if="embedded"
      v-model:open="historyOpen"
      :title="$t('history.heading')"
      side="left"
    >
      <template #body>
        <ChatHistoryList @select="historyOpen = false" />
      </template>
    </USlideover>
  </div>
</template>
