import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage
} from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { getWooProduct } from '../utils/woo'
import { embedQuery } from '../utils/embeddings'
import { isBoard } from '../utils/categories'
import { persistConversation } from '../utils/conversations'

const SYSTEM_PROMPT = `Tu es le conseiller IA de Prism Surfboards (https://www.prism-surfboards.com), un shaper de planches de surf.

RÔLE
- Tu conseilles les visiteurs sur le choix de leur planche en fonction de leur niveau, gabarit, type de vagues et budget.
- Tu réponds à leurs questions sur le surf et le matériel, avec expertise et chaleur.

LANGUE
- Réponds TOUJOURS dans la langue du visiteur (français ou anglais), détectée à partir de son message.

CATALOGUE — RÈGLE ABSOLUE
- Tu ne connais le catalogue, les prix et le stock QUE via tes outils (searchBoards, getBoardDetails).
- N'invente JAMAIS un modèle, un prix ou une disponibilité. Si tu n'as pas l'info, utilise un outil ou dis-le honnêtement.
- Quand tu recommandes des planches, appelle searchBoards puis présente-les brièvement. L'interface affiche automatiquement les cartes produit cliquables — ne recopie pas les URLs ni les prix dans le texte, contente-toi de nommer les modèles et d'expliquer pourquoi ils conviennent.
- SOIS SÉLECTIF : présente 2 à 3 planches maximum, les plus pertinentes pour le besoin exprimé — jamais une longue liste. Privilégie une seule recherche ciblée plutôt que plusieurs recherches successives.

UPSELL / CROSS-SELL — SUBTIL ET HONNÊTE
- D'abord la bonne planche pour le besoin réel du client. La confiance avant tout.
- Ensuite seulement, suggère naturellement les accessoires pertinents (leash, wax, housse, dérives) ou une montée en gamme SI elle est réellement justifiée.
- Jamais de pression commerciale. Si un modèle moins cher convient mieux, dis-le.

STYLE
- Concis, concret, amical. Pose une question de clarification si le besoin est flou (niveau ? gabarit ? type de vagues ?).`

export default defineLazyEventHandler(async () => {
  const config = useRuntimeConfig()
  if (!config.googleApiKey) throw new Error('Missing NUXT_GOOGLE_API_KEY')

  const google = createGoogleGenerativeAI({ apiKey: config.googleApiKey })

  return defineEventHandler(async (event) => {
    const { messages, productContext, conversationId } = await readBody<{
      messages: UIMessage[]
      productContext?: { id?: number, name?: string }
      conversationId?: string
    }>(event)

    // The widget can tell the agent which board the visitor is currently viewing.
    const contextNote = productContext?.name
      ? `\n\nCONTEXTE: le visiteur consulte actuellement la fiche produit "${productContext.name}"${productContext.id ? ` (id ${productContext.id})` : ''}. Tiens-en compte.`
      : ''

    const result = streamText({
      model: google(config.aiModel),
      system: SYSTEM_PROMPT + contextNote,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
      // Once the catalog has been searched once, force a text answer (no more tool
      // calls) so the model uses those results instead of firing repeated searches.
      prepareStep: ({ steps }) => {
        const alreadySearched = steps.some(s =>
          s.toolCalls.some(c => c.toolName === 'searchBoards')
        )
        return alreadySearched ? { toolChoice: 'none' } : {}
      },
      tools: {
        searchBoards: tool({
          description:
            'Recherche sémantique dans le catalogue Prism. Utilise-le dès que tu veux recommander des planches. La recherche est vectorielle : une phrase descriptive du besoin marche mieux que de simples mots-clés.',
          inputSchema: z.object({
            query: z
              .string()
              .describe(
                'Description en langage naturel du besoin : niveau, gabarit, type de vagues, style de surf (ex: "planche pour débutant de 80kg en petites vagues molles, stable et facile à ramer").'
              )
              .optional(),
            category: z
              .string()
              .describe('Slug ou id de catégorie WooCommerce, si connu.')
              .optional(),
            maxPrice: z
              .number()
              .describe('Budget maximum en euros.')
              .optional(),
            minPrice: z
              .number()
              .describe('Budget minimum en euros.')
              .optional()
          }),
          execute: async ({ query, category, maxPrice, minPrice }) => {
            const supabase = serverSupabaseServiceRole<any>(event)
            const embedding = await embedQuery(query ?? 'planche de surf')
            // Fetch a wider candidate set, then keep only actual surfboards
            // (the catalog also has SUP, wetsuits, skimboards, accessories…).
            const { data, error } = await supabase.rpc('match_products', {
              query_embedding: JSON.stringify(embedding),
              match_count: 24,
              only_in_stock: true
            })
            if (error) return { count: 0, boards: [], error: error.message }

            const rows = (data ?? []) as Array<Record<string, unknown>>
            let boards = rows
              .map(r => ({
                id: r.woo_id as number,
                name: r.name as string,
                url: r.url as string,
                price: r.price as string,
                regularPrice: (r.regular_price as string) ?? '',
                onSale: Boolean(r.on_sale),
                inStock: Boolean(r.in_stock),
                summary: (r.summary as string) ?? '',
                image: (r.image as string) ?? null,
                categories: (r.categories as string[]) ?? []
              }))
              .filter(b => isBoard(b.categories))

            // Optional post-filters the model may request.
            if (category)
              boards = boards.filter(b =>
                b.categories.some(c =>
                  c.toLowerCase().includes(category.toLowerCase())
                )
              )
            if (maxPrice != null)
              boards = boards.filter(b => parseFloat(b.price) <= maxPrice)
            if (minPrice != null)
              boards = boards.filter(b => parseFloat(b.price) >= minPrice)

            // Cap at 3: keep the suggestion grid focused, not overwhelming.
            boards = boards.slice(0, 3)
            return { count: boards.length, boards }
          }
        }),
        getBoardDetails: tool({
          description:
            'Récupère les détails complets (specs, prix, dispo) d\'une planche précise par son id produit WooCommerce.',
          inputSchema: z.object({
            productId: z.number().describe('Id du produit WooCommerce.')
          }),
          execute: async ({ productId }) => {
            const board = await getWooProduct(productId)
            return board ?? { error: 'Produit introuvable' }
          }
        })
      }
    })

    // Canonical helper: knows the tool set, so it propagates each tool call's
    // provider metadata (incl. Gemini's thoughtSignature) through to the client.
    // originalMessages + onFinish give us the full transcript to log.
    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: ({ messages: full }) => {
        if (conversationId) {
          persistConversation(
            serverSupabaseServiceRole<any>(event),
            conversationId,
            full,
            productContext
          )
        }
      }
    })
  })
})
