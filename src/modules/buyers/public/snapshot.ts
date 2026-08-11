/**
 * Types et helpers du **snapshot public** d'un bien (contenu servi à la page
 * `/bien/[slug]`). Le snapshot est produit EN BASE (`build_property_public_content`)
 * et ne contient QUE des champs publics sélectionnés — jamais d'adresse exacte,
 * de notes, de documents, de mandat, de données économiques ou du propriétaire.
 *
 * L'URL publique d'un média est reconstruite ici à partir du bucket + chemin
 * (le snapshot est indépendant de l'environnement ; l'hôte Supabase n'y figure pas).
 */

export interface PublicMediaNode {
  id: string;
  kind: string;
  bucket: string;
  storage_path: string;
  mime_type: string;
  alt: string | null;
  caption?: string | null;
  sort_order?: number;
  /** Mode prévisualisation : le chemin pointe le master privé (à signer). */
  needs_sign?: boolean;
  /**
   * URL déjà résolue (prévisualisation : URL signée courte du master injectée
   * côté serveur). Prioritaire sur la reconstruction d'URL publique.
   */
  url?: string | null;
}

export interface PublicSeo {
  index: boolean;
  title: string | null;
  description: string | null;
  social_path: string | null;
}

/** Contenu public sélectionné & figé (aligné sur `build_property_public_content`). */
export interface PublicPropertyContent {
  slug: string | null;
  public_name: string | null;
  tagline: string | null;
  intro: string | null;
  story: string | null;
  experience: string | null;
  architecture: string | null;
  pillars: string | null;
  features: string | null;
  emotional_details: string | null;
  environment: string | null;
  sections: PublicSectionsConfig | null;
  cta_label: string | null;
  show_price: boolean | null;
  price_label: string | null;
  location: string | null;
  seo: PublicSeo | null;
  hero: PublicMediaNode | null;
  main_media: PublicMediaNode | null;
  gallery: PublicMediaNode[];
}

/** Enveloppe renvoyée par `public_property_by_slug`. */
export interface PublicPropertySnapshot {
  slug: string;
  version: number;
  seo_index: boolean;
  published_at: string;
  content: PublicPropertyContent;
}

/** Sections publiques (visibilité + ordre). Toutes optionnelles. */
export type PublicSectionKey =
  | "apercu"
  | "histoire"
  | "experience"
  | "architecture"
  | "caracteristiques"
  | "galerie"
  | "video"
  | "environnement"
  | "details";

export interface PublicSectionsConfig {
  visible?: Partial<Record<PublicSectionKey, boolean>>;
  order?: PublicSectionKey[];
}

/** Ordre par défaut des sections éditoriales (celles réellement renseignées). */
export const DEFAULT_SECTION_ORDER: PublicSectionKey[] = [
  "apercu",
  "histoire",
  "experience",
  "architecture",
  "caracteristiques",
  "galerie",
  "video",
  "environnement",
  "details",
];

/**
 * URL publique d'un média approuvé. Le bucket `property-public` est public :
 * l'objet est servi directement (aucune URL signée). Sans hôte Supabase
 * configuré, renvoie `null` (aucun rendu d'image cassée).
 */
export function publicMediaUrl(
  node:
    | (Pick<PublicMediaNode, "bucket" | "storage_path"> & { url?: string | null })
    | null
    | undefined,
  supabaseUrl: string | undefined,
): string | null {
  if (!node) return null;
  // Prévisualisation : URL signée du master déjà injectée côté serveur.
  if (typeof node.url === "string" && node.url.length > 0) return node.url;
  if (!node.storage_path) return null;
  const base = (supabaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!base) return null;
  // Seul le bucket PUBLIC est servi par URL directe.
  const bucket = node.bucket || "property-public";
  if (bucket !== "property-public") return null;
  return `${base}/storage/v1/object/public/${bucket}/${node.storage_path}`;
}

/** URL publique construite directement depuis un chemin (image sociale SEO). */
export function publicPathUrl(
  storagePath: string | null | undefined,
  supabaseUrl: string | undefined,
  bucket = "property-public",
): string | null {
  if (!storagePath) return null;
  return publicMediaUrl({ bucket, storage_path: storagePath }, supabaseUrl);
}
