import type { UIMessage } from "ai";

// Server-backed conversation history. The visitor is identified by an anonymous
// UUID kept in localStorage (the ONLY thing stored locally — no transcripts, so
// no quota risk). The conversation list and transcripts are fetched from the API
// (/api/conversations), scoped by that visitorId. Shared as a module-level
// singleton so SurfChat and ChatHistoryList read the same reactive state.

export interface ConversationListItem {
  id: string;
  title: string;
  updatedAt: number | string;
}

const VISITOR_KEY = "prism-surf-visitor-v1";
const ACTIVE_KEY = "prism-surf-chat-active-v1";

const conversations = ref<ConversationListItem[]>([]);
const activeId = ref<string | null>(null);
const visitorId = ref<string>("");
let initialized = false;

// Remember which conversation was open so reopening the widget resumes it.
if (import.meta.client) {
  watch(activeId, (id) => {
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch {
      // best-effort
    }
  });
}

function deriveTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = (firstUser?.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
  if (!text) return "Nouvelle conversation";
  return text.length > 48 ? `${text.slice(0, 47)}…` : text;
}

// Stable anonymous id for this browser, created lazily on first use.
function ensureVisitorId(): string {
  if (visitorId.value) return visitorId.value;
  let v = "";
  try {
    v = localStorage.getItem(VISITOR_KEY) ?? "";
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
  } catch {
    v = v || crypto.randomUUID();
  }
  visitorId.value = v;
  return v;
}

async function fetchList() {
  if (!import.meta.client || !visitorId.value) return;
  try {
    const data = await $fetch<ConversationListItem[]>("/api/conversations", {
      query: { visitorId: visitorId.value },
    });
    conversations.value = data ?? [];
  } catch {
    // Network error: keep the current list rather than wiping it.
  }
}

async function load() {
  if (!import.meta.client || initialized) return;
  initialized = true;
  ensureVisitorId();
  await fetchList();
  try {
    const last = localStorage.getItem(ACTIVE_KEY);
    if (last && conversations.value.some((c) => c.id === last)) {
      activeId.value = last;
    }
  } catch {
    // best-effort
  }
}

// Fetch one conversation's full transcript on demand.
async function fetchMessages(id: string): Promise<UIMessage[]> {
  if (!visitorId.value) return [];
  try {
    const data = await $fetch<{ id: string; messages: UIMessage[] }>(
      `/api/conversations/${id}`,
      { query: { visitorId: visitorId.value } },
    );
    return data?.messages ?? [];
  } catch {
    return [];
  }
}

// Switch to a brand-new conversation; the server row appears once it's persisted.
function startNew() {
  activeId.value = crypto.randomUUID();
}

function select(id: string) {
  activeId.value = id;
}

async function remove(id: string) {
  conversations.value = conversations.value.filter((c) => c.id !== id);
  if (activeId.value === id) activeId.value = null;
  if (!visitorId.value) return;
  try {
    await $fetch(`/api/conversations/${id}`, {
      method: "DELETE",
      query: { visitorId: visitorId.value },
    });
  } catch {
    // best-effort; it'll reconcile on next fetchList()
  }
}

// Optimistically reflect the just-finished active conversation in the list
// (the server already persisted it via the chat endpoint). Reconciled by
// fetchList() on the next load.
function noteActive(messages: UIMessage[]) {
  if (!activeId.value) return;
  const id = activeId.value;
  const title = deriveTitle(messages);
  const now = Date.now();
  const existing = conversations.value.find((c) => c.id === id);
  if (existing) {
    existing.title = title;
    existing.updatedAt = now;
  } else {
    conversations.value.unshift({ id, title, updatedAt: now });
  }
  conversations.value.sort(
    (a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)),
  );
}

export function useChatHistory() {
  return {
    conversations,
    activeId,
    visitorId,
    ensureVisitorId,
    load,
    fetchList,
    fetchMessages,
    startNew,
    select,
    remove,
    noteActive,
  };
}
