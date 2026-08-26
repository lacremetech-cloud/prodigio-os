/**
 * Libellé de l'appel à l'action — **paramètre d'expérimentation**, pas une
 * constante éditoriale.
 *
 * Trois formulations sont en attente d'arbitrage. Aucune n'est déclarée
 * gagnante : la variante active se choisit par variable d'environnement
 * (`NEXT_PUBLIC_CTA_VARIANT`), sans toucher au code, et l'événement `cta_click`
 * transporte la variante pour permettre la comparaison.
 *
 * La **destination** ne change jamais : tous les appels à l'action de la page
 * ouvrent le même parcours d'analyse (`ANALYSE_ROUTE`). Il n'existe qu'une
 * seule logique d'ouverture du questionnaire.
 */

export const CTA_VARIANTS = {
  eligibilite: {
    label: "Vérifier l'éligibilité de mon bien",
    /** Variante courte, pour l'en-tête (contrainte de largeur). */
    short: "Vérifier mon éligibilité",
  },
  etude: {
    label: "Faire étudier mon bien",
    short: "Faire étudier mon bien",
  },
  decouvrir: {
    label: "Découvrir ce que Prodigio peut faire pour mon bien",
    short: "Ce que Prodigio peut faire",
  },
} as const;

export type CtaVariantKey = keyof typeof CTA_VARIANTS;

/** Variante par défaut tant qu'aucun test n'a tranché. */
export const DEFAULT_CTA_VARIANT: CtaVariantKey = "eligibilite";

function resolveVariant(): CtaVariantKey {
  const raw = process.env.NEXT_PUBLIC_CTA_VARIANT?.trim();
  if (raw && raw in CTA_VARIANTS) return raw as CtaVariantKey;
  return DEFAULT_CTA_VARIANT;
}

export const CTA_VARIANT: CtaVariantKey = resolveVariant();
export const CTA_LABEL = CTA_VARIANTS[CTA_VARIANT].label;
export const CTA_LABEL_SHORT = CTA_VARIANTS[CTA_VARIANT].short;
