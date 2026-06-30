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
import { getWooProduct } from '../utils/woo'
import { localizeUrl } from '../utils/weglot'

// Surfboard volume guide: recommended litres ≈ bodyweight × a skill-based factor,
// nudged for wave power, age and fitness (smaller waves / older / less fit need
// more float to paddle and catch waves). Returns a sensible litre range.
function computeVolume({
  weightKg,
  level,
  waveType,
  ageOver45,
  lowFitness
}: {
  weightKg: number
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  waveType?: 'small_mushy' | 'average' | 'powerful'
  ageOver45?: boolean
  lowFitness?: boolean
}) {
  const base: Record<string, [number, number]> = {
    beginner: [0.9, 1.0],
    intermediate: [0.55, 0.65],
    advanced: [0.4, 0.45],
    expert: [0.35, 0.4]
  }
  let [lo, hi] = base[level] ?? base.intermediate!
  if (waveType === 'small_mushy') {
    lo += 0.05
    hi += 0.08
  } else if (waveType === 'powerful') {
    lo -= 0.02
    hi -= 0.02
  }
  if (ageOver45) {
    lo += 0.03
    hi += 0.04
  }
  if (lowFitness) {
    lo += 0.03
    hi += 0.04
  }
  return {
    volumeMin: Math.round(weightKg * lo),
    volumeMax: Math.round(weightKg * hi)
  }
}

// Wax hardness tier per water temperature, with a label in each supported locale.
const WAX_TIER: Record<string, { fr: string, en: string }> = {
  cold: { fr: 'froide', en: 'cold' },
  cool: { fr: 'fraîche', en: 'cool' },
  temperate: { fr: 'tempérée', en: 'temperate' },
  warm: { fr: 'chaude', en: 'warm' },
  tropical: { fr: 'tropicale', en: 'tropical' }
}

// Best-effort board length (in feet) from WooCommerce attributes — handles
// 6'4", 188 cm and bare-foot notations. Returns undefined if nothing parses.
function parseLengthFeet(attributes: Record<string, string[]>): number | undefined {
  const key = Object.keys(attributes).find(k => /longueur|length|taille|size/i.test(k))
  const raw = key ? attributes[key]?.[0] : undefined
  if (!raw) return undefined
  const ftIn = raw.match(/(\d+)\s*['’]\s*(\d+)?/)
  if (ftIn) return Number(ftIn[1]) + (ftIn[2] ? Number(ftIn[2]) / 12 : 0)
  const cm = raw.match(/(\d{2,3})\s*cm/i)
  if (cm) return Number(cm[1]) / 30.48
  const ft = raw.match(/(\d+(?:\.\d+)?)/)
  if (ft) return Number(ft[1])
  return undefined
}

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
4. Présente-les brièvement en expliquant pourquoi ils conviennent. Quand tu mentionnes un produit dans le texte, mets son nom en lien Markdown vers sa fiche : [Nom du produit](url) (utilise l'url renvoyée par searchCatalog). Ne recopie pas les prix dans le texte (les cartes s'en chargent).

CHOIX DE LA PLANCHE — EXPERTISE
- Pour un VRAI DÉBUTANT, privilégie d'abord les planches en MOUSSE (gamme STARTER SERIES / Packs Débutant), taillées au gabarit : plus sûres, plus stables, plus flottantes, parfaites pour apprendre. Ne propose les planches époxy/dures (Mini Malibu, Évolutive…) qu'ENSUITE, comme étape de progression, en l'expliquant.
- Adapte toujours au niveau, au gabarit (poids), au type de vagues et au budget. Pose une question de clarification si le besoin est flou.

OUTILS COMPLÉMENTAIRES
- sizeAdvisor : dès que tu connais le poids et le niveau, calcule la fourchette de volume idéale. Sers-t'en pour orienter ta requête searchCatalog (ex. cibler des planches autour du volume conseillé). La carte de volume s'affiche au client.
- getProductDetails : pour détailler UN modèle précis qui intéresse le client (caractéristiques complètes, description). La fiche s'affiche au client.
- compareProducts : quand le client hésite entre 2 à 4 modèles, affiche un tableau comparatif. Identifie d'abord les ids via searchCatalog.
- Ces trois outils affichent eux-mêmes leur résultat au client : commente brièvement, ne recopie pas tout le contenu.

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
    const { messages, productContext, conversationId, locale } = await readBody<{
      messages: UIMessage[]
      productContext?: { id?: number, name?: string }
      conversationId?: string
      locale?: string
    }>(event)

    // The widget can tell the agent which board the visitor is currently viewing.
    const contextNote = productContext?.name
      ? `\n\nCONTEXTE: le visiteur consulte actuellement la fiche produit "${productContext.name}"${productContext.id ? ` (id ${productContext.id})` : ''}. Tiens-en compte.`
      : ''

    const result = streamText({
      model: google(config.aiModel),
      system: SYSTEM_PROMPT + contextNote,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(8),
      tools: {
        searchCatalog: tool({
          description:
            'Recherche sémantique dans le catalogue Prism (planches, SUP/paddle, skimboards, combinaisons, accessoires). Renvoie des CANDIDATS pour ton analyse — ils ne sont PAS affichés au client. Pour montrer des produits, appelle ensuite recommendProducts.',
          inputSchema: z.object({
            query: z
              .string()
              .describe(
                'Description du besoin en langage naturel (niveau, gabarit, type de vagues, style, usage).'
              ),
            productType: z
              .enum(['board', 'sup', 'skimboard', 'wetsuit', 'accessory', 'any'])
              .describe(
                'Type de produit recherché. "board" = planches de surf (le plus fréquent).'
              )
              .optional(),
            maxPrice: z.number().describe('Budget maximum en euros.').optional(),
            minPrice: z.number().describe('Budget minimum en euros.').optional()
          }),
          execute: async ({ query, productType, maxPrice, minPrice }) => {
            const supabase = serverSupabaseServiceRole<any>(event)
            const embedding = await embedQuery(query)
            const { data, error } = await supabase.rpc('match_products', {
              query_embedding: JSON.stringify(embedding),
              match_count: 40,
              only_in_stock: true
            })
            if (error) return { count: 0, candidates: [], error: error.message }

            let candidates = ((data ?? []) as Array<Record<string, unknown>>)
              .map(r => ({
                id: r.woo_id as number,
                name: r.name as string,
                url: localizeUrl(r.url as string, locale),
                categories: (r.categories as string[]) ?? [],
                price: r.price as string,
                inStock: Boolean(r.in_stock),
                summary: ((r.summary as string) ?? '').slice(0, 140)
              }))
              .filter(c => matchesType(c.categories, productType))
            if (maxPrice != null)
              candidates = candidates.filter(c => parseFloat(c.price) <= maxPrice)
            if (minPrice != null)
              candidates = candidates.filter(c => parseFloat(c.price) >= minPrice)
            candidates = candidates.slice(0, 10)
            return { count: candidates.length, candidates }
          }
        }),
        recommendProducts: tool({
          description:
            'Affiche au client les produits recommandés sous forme de cartes cliquables. À appeler APRÈS searchCatalog avec 1 à 4 ids (woo_id), ordonnés du plus au moins pertinent.',
          inputSchema: z.object({
            productIds: z
              .array(z.number())
              .min(1)
              .max(4)
              .describe('Ids produit (woo_id) à recommander, ordonnés par pertinence.')
          }),
          execute: async ({ productIds }) => {
            const supabase = serverSupabaseServiceRole<any>(event)
            const { data, error } = await supabase
              .from('products')
              .select(
                'woo_id, name, url, price, regular_price, on_sale, in_stock, summary, image'
              )
              .in('woo_id', productIds)
            if (error) return { count: 0, products: [], error: error.message }

            const byId = new Map<number, Record<string, unknown>>(
              ((data ?? []) as Array<Record<string, unknown>>).map(r => [
                r.woo_id as number,
                r
              ])
            )
            const products = productIds
              .map(id => byId.get(id))
              .filter((r): r is Record<string, unknown> => Boolean(r))
              .map(r => ({
                id: r.woo_id as number,
                name: r.name as string,
                url: localizeUrl(r.url as string, locale),
                price: r.price as string,
                regularPrice: (r.regular_price as string) ?? '',
                onSale: Boolean(r.on_sale),
                inStock: Boolean(r.in_stock),
                summary: (r.summary as string) ?? '',
                image: (r.image as string) ?? null
              }))
            return { count: products.length, products }
          }
        }),
        sizeAdvisor: tool({
          description:
            "Calcule la fourchette de volume idéale (en litres) d'une planche pour ce surfeur. Appelle-le dès que tu connais le poids et le niveau, AVANT searchCatalog : intègre ensuite le volume conseillé dans ta requête. Le résultat s'affiche au client sous forme de carte ; commente-le, ne le recopie pas en entier.",
          inputSchema: z.object({
            weightKg: z.number().describe('Poids du surfeur en kilogrammes.'),
            level: z
              .enum(['beginner', 'intermediate', 'advanced', 'expert'])
              .describe('Niveau de surf du surfeur.'),
            waveType: z
              .enum(['small_mushy', 'average', 'powerful'])
              .describe(
                'Type de vagues habituel : small_mushy = petites/molles, average = moyennes, powerful = creuses/puissantes.'
              )
              .optional(),
            ageOver45: z
              .boolean()
              .describe('Vrai si le surfeur a plus de 45 ans (ajoute du volume).')
              .optional(),
            lowFitness: z
              .boolean()
              .describe('Vrai si la condition physique est limitée (ajoute du volume).')
              .optional()
          }),
          execute: async ({ weightKg, level, waveType, ageOver45, lowFitness }) => {
            const { volumeMin, volumeMax } = computeVolume({
              weightKg,
              level,
              waveType,
              ageOver45,
              lowFitness
            })
            return { weightKg, level, waveType: waveType ?? 'average', volumeMin, volumeMax }
          }
        }),
        getProductDetails: tool({
          description:
            "Récupère la fiche détaillée d'UN produit (caractéristiques complètes, description, prix, stock) via son woo_id. Utilise-le quand le client veut en savoir plus sur un modèle précis. La fiche s'affiche au client ; commente-la sans tout recopier.",
          inputSchema: z.object({
            productId: z.number().describe('woo_id du produit à détailler.')
          }),
          execute: async ({ productId }) => {
            const p = await getWooProduct(productId)
            if (!p) return { found: false }
            return {
              found: true,
              product: {
                id: p.id,
                name: p.name,
                url: localizeUrl(p.url, locale),
                image: p.image,
                price: p.price,
                regularPrice: p.regularPrice,
                onSale: p.onSale,
                inStock: p.inStock,
                summary: p.summary,
                categories: p.categories,
                specs: Object.entries(p.attributes).map(([label, options]) => ({
                  label,
                  value: options.join(', ')
                }))
              }
            }
          }
        }),
        compareProducts: tool({
          description:
            "Affiche un tableau comparatif côte-à-côte de 2 à 4 produits (caractéristiques, prix, stock) via leurs woo_id. Utilise-le quand le client hésite entre plusieurs modèles. Identifie d'abord les ids via searchCatalog/recommendProducts. Le tableau s'affiche au client ; résume juste les différences clés.",
          inputSchema: z.object({
            productIds: z
              .array(z.number())
              .min(2)
              .max(4)
              .describe('woo_id des produits à comparer (2 à 4).')
          }),
          execute: async ({ productIds }) => {
            const fetched = await Promise.all(productIds.map(id => getWooProduct(id)))
            const products = fetched.filter(
              (p): p is NonNullable<typeof p> => Boolean(p)
            )
            if (products.length < 2) return { count: products.length, products: [], specs: [] }

            // Union of attribute names across products, preserving first-seen order.
            const labels: string[] = []
            for (const p of products)
              for (const label of Object.keys(p.attributes))
                if (!labels.includes(label)) labels.push(label)

            const specs = labels.map(label => ({
              label,
              values: products.map(p => p.attributes[label]?.join(', ') ?? null)
            }))

            return {
              count: products.length,
              products: products.map(p => ({
                id: p.id,
                name: p.name,
                url: localizeUrl(p.url, locale),
                image: p.image,
                price: p.price,
                regularPrice: p.regularPrice,
                onSale: p.onSale,
                inStock: p.inStock
              })),
              specs
            }
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
