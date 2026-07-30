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

/** Rôles pleinement opérationnels (visibilité complète des dossiers) en V1. */
export const OPERATIONAL_ROLES: CrmRole[] = ["administrateur", "manager", "setter"];

/**
 * Rôles réellement **attribuables depuis l'interface** en V1 (invitation /
 * changement de rôle). `partenaire_lecture` en est **exclu** : son isolation fine
 * (dossiers explicitement partagés uniquement) n'est pas terminée — il reste
 * préparé mais non attribuable tant qu'il n'est pas sécurisé (docs/11). La règle
 * est aussi appliquée **en base** (`crm_role_is_assignable`), pas seulement ici.
 */
export const ASSIGNABLE_ROLES: CrmRole[] = [
  "administrateur",
  "manager",
  "setter",
  "agent_immobilier",
];

/** Vrai si le rôle peut être attribué via l'interface en V1. */
export function isAssignableRole(role: string): role is CrmRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/**
 * Explication concise des permissions d'un rôle (affichée dans le formulaire
 * d'invitation et l'écran équipe). Aucune règle codée en dur : purement éditorial.
 */
export const ROLE_PERMISSIONS: Record<CrmRole, string> = {
  administrateur:
    "Accès complet aux dossiers, gestion des membres et invitations, rôles, désactivation, paramètres et journal d'audit.",
  manager:
    "Pilotage opérationnel de tous les dossiers, affectation des leads, pipeline, tâches et activités, décision de segment et audit. Ne gère pas les administrateurs ni la sécurité.",
  setter:
    "Traitement des leads : appels, activités, tâches, changements de stade. Aucune gestion d'utilisateurs.",
  agent_immobilier:
    "Accès en lecture aux seuls dossiers qui lui sont explicitement affectés (qualification, estimation, suivi). Aucune visibilité sur les autres dossiers.",
  partenaire_lecture:
    "Lecture seule, limitée aux dossiers explicitement partagés avec son organisation, coordonnées masquées. Préparé — non attribuable en V1.",
};

/**
 * Destination après connexion / acceptation, selon le rôle le plus fort détenu.
 * En V1 tous les rôles autorisés atterrissent sur le tableau de bord `/crm`
 * (l'espace s'adapte ensuite au rôle via la RLS et l'affichage). Le point
 * d'extension existe pour, plus tard, router un agent vers sa vue dédiée.
 */
export function roleHome(roles: readonly string[]): string {
  if (!hasCrmAccess(roles)) return "/acces";
  return "/crm";
}

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
