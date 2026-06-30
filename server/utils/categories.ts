// Maps the product types the advisor can search to the WooCommerce category names
// stored on each product. Surfboards are the primary use case, but the agent can
// also help with SUP/paddle, skimboards, wetsuits, and accessories.
export const CATEGORY_GROUPS = {
  board: [
    'Surf',
    'Shortboards',
    'Longboards & Mini-Malibu',
    'Fish',
    'Eggs',
    'Évolutive',
    'Mid Length',
    'Mini Longboards',
    'Mini Malibu',
    'Planches pour débutants',
    'Planche de surf pas cher',
    'Performance Series - Classic Shape',
    'Limited Series',
    'Packs Débutant/STARTER SERIES',
    'Pack intermédiaire/ESSENTIAL SERIES'
  ],
  sup: [
    'Stand-Up Paddle',
    'SUPs Rigides',
    'SUP Gonflables',
    'Paddle gonflables',
    'Paddle gonflable pas cher'
  ],
  skimboard: ['Skimboards'],
  wetsuit: ['Combinaison et shorty'],
  accessory: ['Accessoires']
} satisfies Record<string, string[]>

export type ProductType = keyof typeof CATEGORY_GROUPS

// Does a product (by its category names) belong to the requested type group?
// `undefined`/`any` matches everything.
export function matchesType(categories: string[], type?: string): boolean {
  if (!type || type === 'any') return true
  const set = CATEGORY_GROUPS[type as ProductType]
  if (!set) return true
  return categories.some(c => (set as readonly string[]).includes(c))
}
