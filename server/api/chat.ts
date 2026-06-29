import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage
} from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { searchWooProducts, getWooProduct } from '../utils/woo'

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
    const { messages, productContext } = await readBody<{
      messages: UIMessage[]
      productContext?: { id?: number, name?: string }
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
      tools: {
        searchBoards: tool({
          description: 'Recherche des planches de surf dans le catalogue Prism par mots-clés, catégorie et/ou fourchette de prix. Utilise-le dès que tu veux recommander des planches.',
          inputSchema: z.object({
            query: z.string().describe('Mots-clés (ex: "longboard débutant", "shortboard performance", "fish").').optional(),
            category: z.string().describe('Slug ou id de catégorie WooCommerce, si connu.').optional(),
            maxPrice: z.number().describe('Budget maximum en euros.').optional(),
            minPrice: z.number().describe('Budget minimum en euros.').optional()
          }),
          execute: async ({ query, category, maxPrice, minPrice }) => {
            const boards = await searchWooProducts({ search: query, category, maxPrice, minPrice, perPage: 6 })
            return { count: boards.length, boards }
          }
        }),
        getBoardDetails: tool({
          description: 'Récupère les détails complets (specs, prix, dispo) d\'une planche précise par son id produit WooCommerce.',
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
    return result.toUIMessageStreamResponse()
  })
})
