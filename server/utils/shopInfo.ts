// Shop policy knowledge base for the shopInfo tool. The agent answers shipping,
// returns, warranty, care, custom-order, payment, contact and about questions
// ONLY from here, so it never invents a policy.
//
// Content sourced from Prism Surfboards' CGV, delivery policy and About page.
// Topics left empty (care, customLeadTime) are reported as "unavailable" — the
// agent then defers to the human team instead of guessing.

export type ShopInfoTopic =
  | 'shipping'
  | 'returns'
  | 'warranty'
  | 'care'
  | 'customLeadTime'
  | 'payment'
  | 'contact'
  | 'about'

export const SHOP_INFO: Record<ShopInfoTopic, { fr: string, en: string }> = {
  shipping: {
    fr: "Livraison des planches de surf assurée par GEODIS. Les expéditions ont lieu du lundi 14h au vendredi 16h (hors jours fériés). Les délais courent à partir de la prise en charge par le transporteur ; un e-mail confirme l'envoi. Les délais affichés sur le site sont indicatifs. Suivi de commande sur simple demande au 06 81 04 21 49 ou par mail à prismsurfboards@gmail.com. En cas d'anomalie à la réception (colis endommagé, produit manquant ou cassé), il faut refuser la livraison puis nous prévenir par mail à prismsurfboards@gmail.com avec une copie du bon de livraison refusé. Prism ne peut être tenue responsable d'un retard ou d'une perte du fait du transporteur, et un retard ne peut pas donner lieu à l'annulation de la commande.",
    en: "Surfboards are shipped via GEODIS. Orders ship out Monday 2pm to Friday 4pm (excluding public holidays). Delivery times start when the carrier picks up the parcel; a confirmation email is sent at dispatch. Times shown on the site are indicative. Track your order on request at +33 6 81 04 21 49 or prismsurfboards@gmail.com. If anything is wrong on arrival (damaged parcel, missing or broken item), refuse the delivery and email us at prismsurfboards@gmail.com with a copy of the refused delivery note. Prism is not liable for carrier delays or losses, and a delay cannot lead to cancellation of the order."
  },
  returns: {
    fr: "Vous disposez d'un droit de rétractation de 14 jours à compter de la livraison, sans avoir à vous justifier. Les frais de retour sont à votre charge — sauf produit non conforme ou erreur de notre part, auquel cas Prism les prend en charge. Le produit doit être retourné complet, dans son état d'origine (emballage, accessoires, notice) avec une copie de la facture ; les articles incomplets, abîmés ou salis ne sont pas repris. Adresse de retour : PRISM SURFBOARDS, L'Endruère Bâtiment C, 44840 Les Sorinières. Remboursement de la totalité des sommes sous 14 jours après rétractation, sur la carte utilisée lors de la commande ; pour un échange/avoir/remboursement, le délai est de 30 jours maximum après réception des produits. Les articles en soldes, promotion ou discount sont remboursés sous forme d'avoir. Aucun envoi en contre-remboursement n'est accepté.",
    en: "You have a 14-day right of withdrawal from the delivery date, with no need to justify it. Return shipping is at your expense — except for a non-conforming product or an error on our part, which Prism covers. The product must be returned complete, in its original condition (packaging, accessories, manual) with a copy of the invoice; incomplete, damaged or soiled items are not accepted. Return address: PRISM SURFBOARDS, L'Endruère Bâtiment C, 44840 Les Sorinières, France. Full refund within 14 days of withdrawal, to the card used for the order; for an exchange/credit/refund the timeframe is up to 30 days after we receive the products. Sale, promo or discounted items are refunded as store credit. Cash-on-delivery returns are not accepted."
  },
  warranty: {
    fr: "Chaque article bénéficie d'une garantie constructeur pièces et main d'œuvre d'un an. Pour en bénéficier, contactez directement le SAV de Prism Surfboards et joignez impérativement une copie de la facture avec le matériel. La garantie ne couvre pas les dommages d'origine externe (accident, choc), un usage non conforme aux spécifications, l'emploi de produits nuisibles à la bonne conservation de la planche, un usage commercial ou collectif, ni l'utilisation d'accessoires inadaptés. Les frais de transport ne sont pas couverts.",
    en: "Every item comes with a one-year manufacturer warranty covering parts and labour. To use it, contact Prism Surfboards' after-sales service directly and be sure to include a copy of the invoice with the item. The warranty does not cover damage from an external cause (accident, impact), use not in line with the specifications, use of products harmful to the board, commercial or collective use, or use of unsuitable accessories. Transport costs are not covered."
  },
  care: { fr: '', en: '' },
  customLeadTime: { fr: '', en: '' },
  payment: {
    fr: "Le paiement s'effectue par carte bancaire (CB, Visa ou Mastercard) ou via PayPal. Pour la carte bancaire, le débit a lieu le jour de la commande, après autorisation de votre banque ; le paiement en ligne est sécurisé par le système CYBERPLUS PAIEMENT, qui crypte vos coordonnées bancaires lors de leur transmission. En cas d'annulation due à une erreur de votre part impliquant un remboursement, celui-ci peut se faire par chèque bancaire, par annulation de la transaction via notre banque, ou sous forme d'avoir (déduction faite des frais engagés).",
    en: "Payment is made by credit card (CB, Visa or Mastercard) or via PayPal. For card payments, your account is debited on the day of the order, after authorisation from your bank; online card payment is secured by the CYBERPLUS PAIEMENT system, which encrypts your card details during transmission. If an order is cancelled due to a mistake on your side that requires a refund, it can be issued by bank cheque, by cancelling the transaction via our bank, or as store credit (less any costs incurred)."
  },
  contact: {
    fr: "Téléphone : 06 81 04 21 49. Email : prismsurfboards@gmail.com. Adresse : PRISM SURFBOARDS, L'Endruère Bâtiment C, 44840 Les Sorinières, France. Société Prism Surfboards, RCS Nantes 790 586 903, TVA intracommunautaire FR44790586903.",
    en: "Phone: +33 6 81 04 21 49. Email: prismsurfboards@gmail.com. Address: PRISM SURFBOARDS, L'Endruère Bâtiment C, 44840 Les Sorinières, France. Prism Surfboards, Nantes trade register 790 586 903, EU VAT FR44790586903."
  },
  about: {
    fr: "Prism Surfboards est une marque de surf française qui propose une gamme simple, traditionnelle et de qualité, à prix contenu et au design sobre et intemporel — pensée aussi bien pour les débutants que pour les surfeurs exigeants. Les shapes sont choisis et élaborés en France (modèles éprouvés et parmi les plus polyvalents), fabriqués dans de grandes usines avec une finition manuelle soignée, puis conçus et testés dans l'atelier en France. Construction : noyau EPS haute densité, latte centrale pour la solidité, résine époxy (bon compromis légèreté/solidité), fibre de verre biaxiale 6 Oz et 4 Oz, couche de protection supplémentaire sur les 2/3 arrière du pont, montage tri-fins (thruster) avec boîtiers et dérives FCS fournies et renforts fibre sur les boîtiers d'ailerons. Stratification sous vide en salle climatisée pour une planche plus solide et plus légère.",
    en: "Prism Surfboards is a French surf brand offering a simple, traditional, quality range at an affordable price with a clean, timeless design — made for beginners and demanding surfers alike. Shapes are chosen and developed in France (proven, highly versatile models), built in major factories with careful hand finishing, then designed and tested in the French workshop. Construction: high-density EPS core, central stringer for strength, epoxy resin (a good weight/strength balance), 6 Oz and 4 Oz biaxial fibreglass, an extra protective layer over the rear two-thirds of the deck, thruster (tri-fin) setup with FCS boxes and fins included, and extra fibreglass reinforcement around the fin boxes. Vacuum lamination in a climate-controlled room for a stronger, lighter board."
  }
}

export function getShopInfo(topic: ShopInfoTopic, locale?: string) {
  const entry = SHOP_INFO[topic]
  const text = (locale === 'en' ? entry?.en : entry?.fr)?.trim()
  if (!text) return { topic, available: false as const }
  return { topic, available: true as const, info: text }
}
