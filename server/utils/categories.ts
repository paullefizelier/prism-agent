// WooCommerce category names that represent actual surfboards (as stored in the
// product's `categories`). Used to keep the advisor's recommendations to boards
// only — excluding SUP/paddle, wetsuits, skimboards, and the Accessoires catalog
// (leashes, wax…), which are handled separately for cross-sell.
export const BOARD_CATEGORIES = new Set<string>([
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
])

export function isBoard(categories: string[]): boolean {
  return categories.some(c => BOARD_CATEGORIES.has(c))
}
