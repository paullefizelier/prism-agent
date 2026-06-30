// Persists a chat conversation (full transcript + light metadata) for the admin
// dashboard. Best-effort: never throw into the request path.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UIMessage } from 'ai'

// Pull the product ids the agent recommended (via recommendProducts) across the transcript.
function recommendedWooIds(messages: UIMessage[]): number[] {
  const ids = new Set<number>()
  for (const m of messages) {
    for (const part of m.parts) {
      const p = part as { type: string, output?: { products?: { id: number }[] } }
      if (p.type === 'tool-recommendProducts' && p.output?.products) {
        for (const b of p.output.products) ids.add(b.id)
      }
    }
  }
  return [...ids]
}

// First user message text, for the conversation list preview.
function firstUserText(messages: UIMessage[]): string {
  for (const m of messages) {
    if (m.role !== 'user') continue
    for (const part of m.parts) {
      const p = part as { type: string, text?: string }
      if (p.type === 'text' && p.text) return p.text.slice(0, 160)
    }
  }
  return ''
}

export async function persistConversation(
  supabase: SupabaseClient,
  id: string,
  messages: UIMessage[],
  productContext: unknown
): Promise<void> {
  try {
    const { error } = await supabase.from('conversations').upsert(
      {
        id,
        updated_at: new Date().toISOString(),
        preview: firstUserText(messages),
        product_context: productContext ?? null,
        recommended_woo_ids: recommendedWooIds(messages),
        message_count: messages.length,
        messages
      },
      { onConflict: 'id' }
    )
    if (error) console.error('[conversations] persist failed:', error.message)
  } catch (e) {
    console.error('[conversations] persist threw:', e)
  }
}
