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
import { embedQuery } from '../utils/embeddings'
import { matchesType } from '../utils/categories'
import { persistConversation } from '../utils/conversations'

const SYSTEM_PROMPT = `Tu es le conseiller IA de Prism Surfboards (https://www.prism-surfboards.com), un shaper de planches de surf.

RÔLE
- Tu conseilles les visiteurs sur le choix de leur planche en fonction de leur niveau, gabarit, type de vagues et budget.
- Tu réponds à leurs questions sur le surf et le matériel, avec expertise et chaleur.

LANGUE
- Réponds TOUJOURS dans la langue du visiteur (français ou anglais), détectée à partir de son message.

CATALOGUE
- Le catalogue Prism contient surtout des PLANCHES DE SURF (cas principal), mais aussi des SUP/paddles, skimboards, combinaisons néoprène et accessoires (leash, wax, housse, dérives…). Tu peux conseiller sur tous ces produits.
- Tu ne connais le catalogue, les prix et le stock QUE via tes outils. N'invente JAMAIS un modèle, un prix ou une disponibilité.

WORKFLOW DE RECOMMANDATION (à suivre)
1. Appelle searchCatalog avec une description du besoin en langage naturel et le bon productType (board, sup, skimboard, wetsuit, accessory). Ses résultats te sont destinés et NE sont PAS montrés au client.
2. Analyse les candidats et choisis les 2-3 plus pertinents (jamais une longue liste).
3. Appelle recommendProducts avec leurs ids, dans l'ordre de préférence : ce sont eux qui s'affichent en cartes cliquables au client.
4. Présente-les brièvement en expliquant pourquoi ils conviennent. Ne recopie pas les prix ni les URLs dans le texte (les cartes s'en chargent).

CHOIX DE LA PLANCHE — EXPERTISE
- Pour un VRAI DÉBUTANT, privilégie d'abord les planches en MOUSSE (gamme STARTER SERIES / Packs Débutant), taillées au gabarit : plus sûres, plus stables, plus flottantes, parfaites pour apprendre. Ne propose les planches époxy/dures (Mini Malibu, Évolutive…) qu'ENSUITE, comme étape de progression, en l'expliquant.
- Adapte toujours au niveau, au gabarit (poids), au type de vagues et au budget. Pose une question de clarification si le besoin est flou.

UPSELL / CROSS-SELL — SUBTIL ET HONNÊTE
- D'abord le bon produit pour le besoin réel. La confiance avant tout.
- Ensuite seulement, suggère naturellement les accessoires pertinents (leash, wax, housse…) : un searchCatalog(accessory) puis recommendProducts. Jamais de pression. Si un modèle moins cher convient mieux, dis-le.

STYLE
- Concis, concret, amical, dans la langue du visiteur.`

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
