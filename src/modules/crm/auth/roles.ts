/**
 * Rôles CRM et logique d'autorisation **pure** (aucune dépendance serveur, donc
 * testable unitairement). Les rôles vivent en base (organization_memberships) et
 * ne sont JAMAIS codés en dur dans les composants : l'UI interroge ces helpers.
 *
 * V1 pleinement opérationnelle pour administrateur / manager / setter. Les rôles
 * agent_immobilier et partenaire_lecture sont préparés (architecture prête) sans
 * être surdimensionnés.
 */

export const CRM_ROLES = [
  "administrateur",
  "manager",
  "setter",
  "agent_immobilier",
  "partenaire_lecture",
] as const;

export type CrmRole = (typeof CRM_ROLES)[number];

/** Rôles pleinement opérationnels dans cette V1. */
export const OPERATIONAL_ROLES: CrmRole[] = ["administrateur", "manager", "setter"];

/** Vrai si l'ensemble de rôles contient au moins un des rôles requis. */
export function hasAnyRole(
  roles: readonly string[],
  required: readonly CrmRole[],
): boolean {
  return roles.some((r) => (required as readonly string[]).includes(r));
}

/** Accès CRM = au moins un rôle reconnu (membership actif). */
export function hasCrmAccess(roles: readonly string[]): boolean {
  return roles.some((r) => (CRM_ROLES as readonly string[]).includes(r));
}

/** Peut opérer le setting (affecter, appeler, noter, changer de stade…). */
export function canOperate(roles: readonly string[]): boolean {
  return hasAnyRole(roles, ["administrateur", "manager", "setter"]);
}

/** Peut voir les coordonnées sensibles (téléphone / e-mail). */
export function canViewContactDetails(roles: readonly string[]): boolean {
  return hasAnyRole(roles, [
    "administrateur",
    "manager",
    "setter",
    "agent_immobilier",
  ]);
}

/** Peut valider un segment (décision humaine ≠ recommandation du scoring). */
export function canDecideSegment(roles: readonly string[]): boolean {
  return hasAnyRole(roles, ["administrateur", "manager"]);
}

/** Peut consulter le journal d'audit. */
export function canViewAudit(roles: readonly string[]): boolean {
  return hasAnyRole(roles, ["administrateur", "manager"]);
}

/** Peut gérer les membres (inviter / changer les rôles). */
export function canManageMembers(roles: readonly string[]): boolean {
  return hasAnyRole(roles, ["administrateur"]);
}

/** Le rôle « le plus fort » détenu, pour l'affichage (ordre décroissant). */
export function primaryRole(roles: readonly string[]): CrmRole | null {
  for (const r of CRM_ROLES) {
    if (roles.includes(r)) return r;
  }
  return null;
}

/**
 * Masque une coordonnée sensible pour les rôles non autorisés. Renvoie une chaîne
 * neutre (jamais la valeur réelle) plutôt que de fuiter la donnée.
 */
export function maskContactValue(
  value: string | null | undefined,
  canView: boolean,
): string | null {
  if (value == null || value === "") return null;
  if (canView) return value;
  return "•••• masqué";
}
