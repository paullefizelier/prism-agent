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
import { getWooProduct, getWooAvailability } from '../utils/woo'
import { getShopInfo, type ShopInfoTopic } from '../utils/shopInfo'
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
- completeTheKit : une fois une planche choisie, propose l'équipement complémentaire (leash dimensionné, wax selon l'eau, housse). Passe-lui le boardId de la planche (et waterTemp si tu la connais). Il affiche une checklist + les accessoires.
- checkAvailability : pour vérifier le stock temps réel d'un modèle ou la disponibilité d'une taille précise.
- shopInfo : pour toute question de politique/SAV (livraison, retours, garantie, entretien, délais sur-mesure, paiement, contact) ainsi que sur la marque et la fabrication des planches (topic "about"). Si l'info n'est pas disponible, NE l'invente PAS — propose de mettre le client en relation avec l'équipe Prism.
- contactRequest : pour transférer le client à l'équipe avec ses coordonnées — rappel/contact, SAV/garantie, devis ou commande pro/club, ou demande de planche sur-mesure. Recueille d'abord le nom, l'email et un message (le brief pour un sur-mesure), + le téléphone si le client veut être rappelé, puis enregistre la demande avec le bon motif.
- Ces outils affichent eux-mêmes leur résultat au client : commente brièvement, ne recopie pas tout le contenu.

UPSELL / CROSS-SELL — SUBTIL ET HONNÊTE
- D'abord le bon produit pour le besoin réel. La confiance avant tout.
- Ensuite seulement, propose l'équipement complémentaire via completeTheKit (le moyen privilégié : il dimensionne et propose leash/wax/housse en une fois). Jamais de pression. Si un modèle moins cher convient mieux, dis-le.

STYLE
- Concis, concret, amical, dans la langue du visiteur.`

export default defineLazyEventHandler(async () => {
  const config = useRuntimeConfig()
  if (!config.googleApiKey) throw new Error('Missing NUXT_GOOGLE_API_KEY')

  const google = createGoogleGenerativeAI({ apiKey: config.googleApiKey })

  return defineEventHandler(async (event) => {
    // Anti-spam: ~30 messages / 10 min per IP (Supabase-backed, shared across
    // serverless instances). Fails open if the migration isn't applied yet.
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
    const { data: allowed } = await serverSupabaseServiceRole<any>(event).rpc(
      'check_rate_limit',
      { p_key: `chat:${ip}`, p_limit: 30, p_window_seconds: 600 }
    )
    if (allowed === false) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Trop de messages, réessaie dans un instant.'
      })
    }

    const { messages, productContext, conversationId, locale, visitorId } = await readBody<{
      messages: UIMessage[]
      productContext?: {
        type?: 'product' | 'category'
        id?: number
        name?: string
        categoryName?: string
        categorySlug?: string
      }
      conversationId?: string
      locale?: string
      visitorId?: string
    }>(event)

    // The widget passes the page the visitor is on (product or category) so the
    // agent can tailor its recommendations.
    let contextNote = ''
    if (productContext?.type === 'category' && productContext.categoryName) {
      contextNote = `\n\nCONTEXTE: le visiteur navigue dans la catégorie "${productContext.categoryName}". Oriente tes recommandations vers cette catégorie quand c'est pertinent (commence par y chercher).`
    } else if (productContext?.name) {
      contextNote = `\n\nCONTEXTE: le visiteur consulte actuellement la fiche produit "${productContext.name}"${productContext.id ? ` (id ${productContext.id})` : ''}. Tiens-en compte.`
    }

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
        }),
        completeTheKit: tool({
          description:
            "Recommande l'équipement complémentaire d'une planche choisie : dimensionne le leash et la housse d'après la longueur de la planche, conseille le wax selon la température de l'eau, et propose les accessoires correspondants du catalogue. Utilise-le APRÈS qu'une planche a été choisie/recommandée, pour le cross-sell. Le résultat (checklist + cartes accessoires) s'affiche au client : commente brièvement.",
          inputSchema: z.object({
            boardId: z
              .number()
              .describe('woo_id de la planche choisie (pour déduire sa longueur).')
              .optional(),
            boardLengthFeet: z
              .number()
              .describe("Longueur de la planche en pieds (ex. 6.5 pour 6'6\"). Fournis-le si connu, sinon boardId tentera de le déduire.")
              .optional(),
            waterTemp: z
              .enum(['cold', 'cool', 'temperate', 'warm', 'tropical'])
              .describe("Température de l'eau, pour le choix du wax.")
              .optional(),
            include: z
              .array(z.enum(['leash', 'wax', 'bag']))
              .describe('Accessoires à proposer. Par défaut : leash, wax et housse.')
              .optional()
          }),
          execute: async ({ boardId, boardLengthFeet, waterTemp, include }) => {
            const supabase = serverSupabaseServiceRole<any>(event)
            const categories = include?.length ? include : ['leash', 'wax', 'bag']

            // Resolve board length from the product when not given.
            let lengthFeet = boardLengthFeet
            if (lengthFeet == null && boardId != null) {
              const board = await getWooProduct(boardId)
              lengthFeet = board ? parseLengthFeet(board.attributes) : undefined
            }

            // Domain sizing rules: leash ≥ board length (rounded up, min 6');
            // boardbag ~6 inches longer than the board.
            const leashLength = lengthFeet ? Math.max(6, Math.ceil(lengthFeet)) : null
            const bagLength = lengthFeet ? Math.ceil(lengthFeet * 2) / 2 + 0.5 : null
            const waxTemp = waterTemp
              ? WAX_TIER[waterTemp]![locale === 'en' ? 'en' : 'fr']
              : null

            const guidance = {
              leashLength: categories.includes('leash') ? leashLength : null,
              waxTemp: categories.includes('wax') ? waxTemp : null,
              bagLength: categories.includes('bag') ? bagLength : null
            }

            // One semantic query per requested accessory, picking the best
            // in-stock accessory match for each (no duplicates).
            const queries: Record<string, string> = {
              leash: `leash surf${leashLength ? ` ${leashLength} pieds` : ''}`,
              wax: `wax surf${waxTemp ? ` eau ${waxTemp}` : ''}`,
              bag: `housse de surf${bagLength ? ` ${bagLength} pieds` : ''}`
            }

            const pickedIds: number[] = []
            for (const cat of categories) {
              const embedding = await embedQuery(queries[cat]!)
              const { data } = await supabase.rpc('match_products', {
                query_embedding: JSON.stringify(embedding),
                match_count: 20,
                only_in_stock: true
              })
              const top = ((data ?? []) as Array<Record<string, unknown>>)
                .map(r => ({
                  id: r.woo_id as number,
                  categories: (r.categories as string[]) ?? []
                }))
                .filter(c => matchesType(c.categories, 'accessory'))
                .map(c => c.id)
                .find(id => !pickedIds.includes(id))
              if (top != null) pickedIds.push(top)
            }

            if (!pickedIds.length) return { guidance, products: [] }

            const { data: rows } = await supabase
              .from('products')
              .select('woo_id, name, url, price, regular_price, on_sale, in_stock, image')
              .in('woo_id', pickedIds)
            const byId = new Map<number, Record<string, unknown>>(
              ((rows ?? []) as Array<Record<string, unknown>>).map(r => [
                r.woo_id as number,
                r
              ])
            )
            const products = pickedIds
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
                image: (r.image as string) ?? null
              }))

            return { guidance, products }
          }
        }),
        checkAvailability: tool({
          description:
            "Vérifie le stock temps réel d'un produit et, pour les produits à tailles/variations, la disponibilité de chaque taille. Utilise-le quand le client demande si un modèle ou une taille est dispo. Le résultat s'affiche au client.",
          inputSchema: z.object({
            productId: z.number().describe('woo_id du produit.')
          }),
          execute: async ({ productId }) => {
            const a = await getWooAvailability(productId)
            if (!a) return { found: false }
            return {
              found: true,
              availability: { ...a, url: localizeUrl(a.url, locale) }
            }
          }
        }),
        shopInfo: tool({
          description:
            "Renvoie les informations officielles de la boutique (livraison, retours, garantie, entretien, délais sur-mesure, paiement, contact). Utilise-le pour toute question de politique/SAV. Si l'info n'est pas disponible (available=false), ne l'invente PAS : propose de mettre le client en relation avec l'équipe Prism.",
          inputSchema: z.object({
            topic: z
              .enum([
                'shipping',
                'returns',
                'warranty',
                'care',
                'customLeadTime',
                'payment',
                'contact',
                'about'
              ])
              .describe(
                'Sujet de la question. "about" = la marque Prism et la fabrication/construction des planches.'
              )
          }),
          execute: async ({ topic }) => getShopInfo(topic as ShopInfoTopic, locale)
        }),
        contactRequest: tool({
          description:
            "Enregistre une demande de contact / un transfert vers l'équipe Prism avec les coordonnées du client. Utilise-le dès qu'un humain est nécessaire : le client veut être recontacté, a un problème SAV/garantie, demande un devis ou une commande pro/club, ou veut une planche sur-mesure. À appeler UNIQUEMENT après avoir recueilli le nom, l'email et un message décrivant le besoin (+ le téléphone si le client veut être rappelé). Une confirmation s'affiche au client.",
          inputSchema: z.object({
            reason: z
              .enum(['callback', 'sav', 'quote', 'custom_shape', 'other'])
              .describe(
                'Motif : callback = rappel/contact, sav = après-vente/garantie, quote = devis/commande pro/club, custom_shape = planche sur-mesure, other = autre.'
              ),
            name: z.string().describe('Nom du client.'),
            email: z.string().describe('Email du client.'),
            phone: z
              .string()
              .describe('Téléphone (recommandé pour un rappel, sinon optionnel).')
              .optional(),
            message: z
              .string()
              .describe(
                'Description du besoin : pour un sur-mesure le brief (gabarit, niveau, vagues, style, budget) ; sinon la question/le problème/la demande de devis.'
              )
          }),
          execute: async ({ reason, name, email, phone, message }) => {
            const supabase = serverSupabaseServiceRole<any>(event)
            const { error } = await supabase.from('leads').insert({
              reason,
              name,
              email,
              phone: phone ?? null,
              message,
              product_context: productContext ?? null,
              conversation_id: conversationId ?? null
            })
            if (error) {
              console.error('[leads] insert failed:', error.message)
              return { ok: false }
            }
            return { ok: true, reason, name }
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
            productContext,
            visitorId
          )
        }
      }
    })
  })
})
