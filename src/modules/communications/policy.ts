/**
 * `CommunicationPolicy` — **explication** des décisions d'envoi.
 *
 * ⚠️ L'AUTORITÉ est la base de données (`crm_comm_eligibility` et
 * `crm_comm_prepare_message`, toutes deux `SECURITY DEFINER`). Ce module ne
 * décide rien : il reproduit la même logique pour **prévoir** et **expliquer**
 * une décision dans l'interface, sans jamais l'imposer.
 *
 * Le navigateur ne peut donc pas contourner la politique : même en falsifiant un
 * appel, la base refuse.
 */

import type {
  BlockedReason,
  Category,
  Channel,
  EligibilityDecision,
  SuppressionScope,
} from "./types";

/** Choix RGPD enregistré, tel que porté par `privacy_records`. */
export interface PrivacySignal {
  choice: "accorde" | "refuse" | "retire";
  legalBasis: string;
  authorizedChannels: readonly string[];
  doNotContact: boolean;
}

/** Opposition active, telle que portée par `communication_suppressions`. */
export interface SuppressionSignal {
  channel: Channel | "tout";
  scope: SuppressionScope;
  active: boolean;
}

export interface PolicyInput {
  channel: Channel;
  category: Category;
  /** Adresse ou téléphone disponible pour ce canal. */
  hasAddress: boolean;
  privacy: readonly PrivacySignal[];
  suppressions: readonly SuppressionSignal[];
  /** Modèle actif disponible pour cette clé et ce canal. */
  templateStatus: "actif" | "brouillon" | "archive" | "absent";
  /** Google Calendar assure-t-il déjà cet envoi ? */
  googleCovers?: boolean;
  /** L'envoi réel est-il activé ? Sinon le message reste préparé, jamais émis. */
  dispatchEnabled?: boolean;
}

/**
 * La base légale `a_valider_juridiquement` est la valeur par défaut du projet :
 * elle signifie « non tranchée », **jamais** « consentement ». Aucune finalité
 * marketing ne peut s'en prévaloir.
 */
export const UNSETTLED_LEGAL_BASIS = "a_valider_juridiquement";

/**
 * Décide — à titre explicatif — si un message peut exister. Les vérifications
 * sont ordonnées de la plus absolue à la plus contextuelle, dans le même ordre
 * que la fonction SQL, afin que les deux ne puissent pas diverger.
 */
export function evaluatePolicy(input: PolicyInput): EligibilityDecision {
  if (!input.hasAddress) return deny("coordonnee_absente");

  if (input.privacy.some((p) => p.doNotContact)) return deny("ne_plus_contacter");

  const blocked = input.suppressions.some(
    (s) =>
      s.active &&
      (s.channel === input.channel || s.channel === "tout") &&
      (s.scope === input.category || s.scope === "tout"),
  );
  if (blocked) return deny("opposition_active");

  if (input.category === "marketing") {
    const settled = input.privacy.some(
      (p) =>
        p.choice === "accorde" &&
        p.legalBasis !== UNSETTLED_LEGAL_BASIS &&
        p.authorizedChannels.includes(input.channel),
    );
    if (!settled) return deny("base_legale_insuffisante");
  }

  if (input.googleCovers) return deny("google_couvre_l_envoi");

  if (input.templateStatus === "absent") return deny("modele_absent");
  if (input.templateStatus !== "actif") return deny("modele_inactif");

  if (input.dispatchEnabled === false) return deny("envoi_desactive");

  return { allowed: true, reason: null };
}

function deny(reason: BlockedReason): EligibilityDecision {
  return { allowed: false, reason };
}

/** Explication lisible d'un motif de blocage, destinée à l'utilisateur du CRM. */
export const BLOCKED_REASON_LABELS: Record<BlockedReason, string> = {
  coordonnee_absente: "Aucune coordonnée exploitable pour ce canal",
  ne_plus_contacter: "La personne a demandé à ne plus être contactée",
  opposition_active: "Une opposition active bloque ce canal",
  base_legale_insuffisante: "Base légale insuffisante pour une finalité marketing",
  canal_non_autorise: "Canal non autorisé",
  modele_absent: "Aucun modèle n'existe pour cet événement",
  modele_inactif: "Le modèle existe mais n'est pas activé",
  google_couvre_l_envoi: "Google Calendar envoie déjà ce message — doublon évité",
  envoi_desactive: "L'envoi réel est désactivé",
};

/** Explication détaillée : pourquoi ce blocage, et que faire ensuite. */
export const BLOCKED_REASON_HINTS: Record<BlockedReason, string> = {
  coordonnee_absente:
    "Renseignez une adresse e-mail (ou un téléphone pour le SMS) sur la fiche du contact.",
  ne_plus_contacter:
    "Cette opposition est absolue et prévaut sur toute autre règle. Elle ne se lève pas depuis cet écran.",
  opposition_active:
    "Un administrateur peut lever l'opposition depuis l'onglet Oppositions, avec un motif tracé.",
  base_legale_insuffisante:
    "La base légale du traitement reste à valider juridiquement. Aucune campagne ne peut partir tant que ce point n'est pas tranché.",
  canal_non_autorise: "Ce canal n'est pas couvert par la V1.",
  modele_absent: "Créez un modèle portant cette clé, puis activez-le.",
  modele_inactif: "Activez la version du modèle destinée à cet événement.",
  google_couvre_l_envoi:
    "Le propriétaire est invité à l'événement Google : Google a déjà envoyé ce message. Prodigio ne le double pas.",
  envoi_desactive:
    "Le message est préparé et tracé, mais aucun envoi réel n'a lieu tant que l'interrupteur n'est pas activé.",
};
