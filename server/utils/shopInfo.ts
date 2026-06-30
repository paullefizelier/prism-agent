// Shop policy knowledge base for the shopInfo tool. The agent answers shipping,
// returns, warranty, care and custom-order questions ONLY from here, so it never
// invents a policy.
//
// ⚠️ TO ACTIVATE: fill in the real text below (FR + EN) for each topic you want
// the agent to answer. Topics left empty are reported as "unavailable" — the
// agent will then defer to the human team instead of guessing.

export type ShopInfoTopic =
  | 'shipping'
  | 'returns'
  | 'warranty'
  | 'care'
  | 'customLeadTime'
  | 'payment'
  | 'contact'

export const SHOP_INFO: Record<ShopInfoTopic, { fr: string, en: string }> = {
  shipping: { fr: '', en: '' },
  returns: { fr: '', en: '' },
  warranty: { fr: '', en: '' },
  care: { fr: '', en: '' },
  customLeadTime: { fr: '', en: '' },
  payment: { fr: '', en: '' },
  contact: { fr: '', en: '' }
}

export function getShopInfo(topic: ShopInfoTopic, locale?: string) {
  const entry = SHOP_INFO[topic]
  const text = (locale === 'en' ? entry?.en : entry?.fr)?.trim()
  if (!text) return { topic, available: false as const }
  return { topic, available: true as const, info: text }
}
