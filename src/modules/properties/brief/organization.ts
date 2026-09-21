/**
 * Résolution de l'organisation porteuse d'un bien partenaire — logique **pure**,
 * donc testable sans base.
 *
 * Règle : on ne crée jamais un doublon. Une organisation déjà enregistrée sous le
 * même nom ou le même identifiant (slug) est **réutilisée**. L'enregistrement
 * n'a lieu qu'à la confirmation explicite, jamais au clic sur « Analyser ».
 */

export interface OrganizationCandidate {
  id: string;
  name: string;
  slug: string;
  kind: string;
}

export type OrganizationResolution =
  /** Aucun nom d'organisation dans le brief : la Fabrique ne peut pas créer. */
  | { status: "absente" }
  /** Une organisation existante correspond exactement : on la réutilise. */
  | { status: "existante"; organization: OrganizationCandidate }
  /** Plusieurs correspondances : un humain tranche, jamais l'analyseur. */
  | { status: "ambigue"; candidates: OrganizationCandidate[]; requested: string }
  /** Aucune correspondance : proposition d'enregistrement, à confirmer. */
  | { status: "a_enregistrer"; name: string; slug: string };

/** Minuscule sans accent — comparaison de libellés uniquement. */
function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[  ]/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Identifiant stable dérivé du nom : minuscules, sans accent, tirets. Conforme
 * au nettoyage appliqué en base par `crm_register_partner_organization`.
 */
export function slugifyOrganization(name: string): string {
  return fold(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * Confronte le nom lu dans le brief à l'annuaire des organisations connues.
 * Ne crée rien : renvoie seulement ce qu'il faudrait faire.
 */
export function resolveOrganization(
  requestedName: string | null,
  known: readonly OrganizationCandidate[],
): OrganizationResolution {
  const requested = (requestedName ?? "").trim();
  if (!requested) return { status: "absente" };

  const wanted = fold(requested);
  const wantedSlug = slugifyOrganization(requested);
  const matches = known.filter(
    (org) => fold(org.name) === wanted || org.slug === wantedSlug,
  );

  if (matches.length === 1 && matches[0]) {
    return { status: "existante", organization: matches[0] };
  }
  if (matches.length > 1) {
    return { status: "ambigue", candidates: [...matches], requested };
  }
  if (!wantedSlug) return { status: "absente" };
  return { status: "a_enregistrer", name: requested, slug: wantedSlug };
}
