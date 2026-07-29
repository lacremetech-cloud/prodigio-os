/**
 * Manifeste des visuels premium du funnel Mandats.
 *
 * Source de vérité : dimensions réelles (pour `next/image`, évite tout
 * décalage de mise en page), texte alternatif, et crédits/licences. Les fichiers
 * sont téléchargés dans le dépôt (`public/images/mandate/`), jamais en hotlink.
 * Sélection éditoriale provisoire — remplaçable par les shootings Prodigio.
 * Crédits complets et sources : `docs/08-MEDIA-CREDITS.md`.
 */

export interface MediaAsset {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export const media = {
  hero: {
    src: "/images/mandate/hero.webp",
    width: 2400,
    height: 1350,
    alt: "Villa contemporaine d'exception aux grandes baies vitrées, lumière chaude de fin de journée.",
  },
  vsl: {
    src: "/images/mandate/vsl.webp",
    width: 2000,
    height: 1334,
    alt: "Séjour raffiné avec cheminée et vastes ouvertures, ambiance éditoriale.",
  },
  constat: {
    src: "/images/mandate/constat.webp",
    width: 2000,
    height: 1334,
    alt: "Intérieur épuré ouvert sur une vue dégagée, atmosphère calme et haut de gamme.",
  },
  confirmation: {
    src: "/images/mandate/confirmation.webp",
    width: 1500,
    height: 2250,
    alt: "Rive au crépuscule, eau parfaitement calme — atmosphère sereine.",
  },
  ambiance1: {
    src: "/images/mandate/ambiance-1.webp",
    width: 1900,
    height: 2850,
    alt: "Galerie en pierre aux arches et colonnes, tons chauds et feutrés.",
  },
  ambiance2: {
    src: "/images/mandate/ambiance-2.webp",
    width: 1900,
    height: 2534,
    alt: "Façade classique en pierre à l'heure dorée, architecture française.",
  },
  categoryVilla: {
    src: "/images/mandate/cat-villa.webp",
    width: 1400,
    height: 933,
    alt: "Villa d'architecte contemporaine entourée de verdure.",
  },
  categoryAppartement: {
    src: "/images/mandate/cat-appartement.webp",
    width: 1400,
    height: 933,
    alt: "Séjour d'un appartement d'exception, lumineux et spacieux.",
  },
  categoryChalet: {
    src: "/images/mandate/cat-chalet.webp",
    width: 1400,
    height: 933,
    alt: "Chalet de prestige sous la neige, entouré de sapins et de montagnes.",
  },
  categoryDomaine: {
    src: "/images/mandate/cat-domaine.webp",
    width: 1400,
    height: 933,
    alt: "Château au cœur d'un domaine verdoyant, propriété de caractère.",
  },
  categoryAutre: {
    src: "/images/mandate/cat-autre.webp",
    width: 1400,
    height: 672,
    alt: "Résidences contemporaines en bord d'eau, reflets sur un lac calme.",
  },
} as const satisfies Record<string, MediaAsset>;

export type MediaKey = keyof typeof media;
