import type { UIMessage } from "ai";

// Per-browser conversation history, persisted to localStorage. Shared as a
// module-level singleton so the chat panel (SurfChat) and the history list
// (ChatHistoryList) read and write the exact same reactive state, whether the
// list is rendered in the full-screen sidebar or the iframe slideover.

export interface ChatConversation {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "prism-surf-chat-history-v1";
const ACTIVE_KEY = "prism-surf-chat-active-v1";
const MAX_CONVERSATIONS = 30;

const conversations = ref<ChatConversation[]>([]);
const activeId = ref<string | null>(null);
let initialized = false;

// Remember which conversation was open so reopening the widget (after the host
// page reloads/navigates) resumes it instead of starting a fresh chat.
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

function load() {
  if (!import.meta.client || initialized) return;
  initialized = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) conversations.value = JSON.parse(raw) as ChatConversation[];
    // Resume the last open conversation if it's still stored.
    const last = localStorage.getItem(ACTIVE_KEY);
    if (last && conversations.value.some((c) => c.id === last)) {
      activeId.value = last;
    }
  } catch {
    // Corrupted/unreadable storage: start clean rather than crash the widget.
  }
}

function persist() {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.value));
  } catch {
    // Quota exceeded or serialization issue: drop silently, history is best-effort.
  }
}

// Switch to a brand-new (unsaved) conversation. The entry is only written on
// the first exchange, so empty "new" chats never clutter the list.
function startNew() {
  activeId.value = crypto.randomUUID();
}

function select(id: string) {
  activeId.value = id;
}

function remove(id: string) {
  conversations.value = conversations.value.filter((c) => c.id !== id);
  if (activeId.value === id) activeId.value = null;
  persist();
}

// Create or update the active conversation from the current message list, then
// move it to the front (most-recent first) and prune the oldest beyond the cap.
function upsertActive(messages: UIMessage[]) {
  if (!activeId.value) return;
  const id = activeId.value;
  const now = Date.now();
  // Detach from reactive/streaming refs so stored data is a stable snapshot.
  const snapshot = JSON.parse(JSON.stringify(messages)) as UIMessage[];
  const title = deriveTitle(snapshot);

  const idx = conversations.value.findIndex((c) => c.id === id);
  const entry: ChatConversation =
    idx >= 0
      ? { ...conversations.value[idx]!, title, messages: snapshot, updatedAt: now }
      : { id, title, messages: snapshot, createdAt: now, updatedAt: now };

  const next = conversations.value.filter((c) => c.id !== id);
  next.unshift(entry);
  conversations.value = next.slice(0, MAX_CONVERSATIONS);
  persist();
}

export function useChatHistory() {
  return {
    conversations,
    activeId,
    load,
    startNew,
    select,
    remove,
    upsertActive,
  };
}
