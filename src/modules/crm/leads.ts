/**
 * Modèle d'agrégat « Lead » (vue CRM d'une opportunité de mandat) et logique
 * **pure** de filtrage / tri / indicateurs. Aucune dépendance serveur : ces
 * fonctions sont testables et alimentent la boîte de réception et la vue
 * d'ensemble sans dupliquer de données (on lit contacts/opportunities/…).
 *
 * Rappel des distinctions fondatrices respectées ici :
 *  - le STADE (pipeline) ≠ le SEGMENT (catégorie du bien) ;
 *  - la RECOMMANDATION du scoring ≠ la décision humaine ;
 *  - une TENTATIVE d'appel est une activité, jamais un stade.
 */

export interface LeadAssignee {
  userId: string;
  responsibility: string;
  name: string;
}

export interface LeadNextTask {
  id: string;
  title: string;
  kind: string;
  dueAt: string | null;
}

export interface Lead {
  opportunityId: string;
  createdAt: string;
  stage: string;
  segment: string;
  processingStatus: string;
  outcome: string | null;
  /** Décision d'éligibilité VALIDÉE (distincte du stade et du segment). */
  eligibilityDecision: string | null;

  // Bien candidat
  propertyType: string | null;
  city: string | null;
  postalCode: string | null;
  valueBand: string | null;
  saleHorizon: string | null;
  mandateSituation: string | null;

  // Analyse (recommandation)
  compatibilityScore: number | null;
  maturityScore: number | null;
  recommendedPriority: string | null;
  publicAppreciation: string | null;

  // Contact principal
  contactId: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactPreference: string | null;
  recallPreference: string | null;

  assignees: LeadAssignee[];
  nextTask: LeadNextTask | null;
  lastActivityAt: string | null;
}

export type QuickFilter =
  | "tous"
  | "nouveau"
  | "non_affecte"
  | "fort_potentiel"
  | "a_rappeler"
  | "en_retard";

export type LeadSort =
  | "recent"
  | "ancien"
  | "priorite"
  | "compatibilite"
  | "maturite";

export interface LeadFilters {
  quick: QuickFilter;
  search: string;
  stage: string | null;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  rappel_prioritaire: 3,
  circuit_partenaire: 2,
  nurturing: 1,
  suivi_long_terme: 0,
};

/** Un lead est-il « à fort potentiel » ? (recommandation, jamais une décision) */
export function isHighPotential(lead: Lead): boolean {
  return (
    lead.recommendedPriority === "rappel_prioritaire" ||
    lead.publicAppreciation === "fort_potentiel" ||
    (lead.compatibilityScore ?? 0) >= 60
  );
}

export function isUnassigned(lead: Lead): boolean {
  return lead.assignees.length === 0;
}

/**
 * Dossier en attente d'une décision d'éligibilité : le rendez-vous a été réalisé
 * (ou l'étude est en cours) mais aucune décision d'éligibilité n'a été validée
 * (ou elle est « à compléter »). Dérivé du STADE + de la décision — jamais du
 * segment. Une opportunité perdue ou disqualifiée n'y figure pas.
 */
export function isAwaitingEligibility(lead: Lead): boolean {
  const reached =
    lead.stage === "rendez_vous_realise" || lead.stage === "estimation_etude_dossier";
  const decided =
    lead.eligibilityDecision != null && lead.eligibilityDecision !== "a_completer";
  return reached && !decided && lead.outcome == null;
}

export function isNew(lead: Lead): boolean {
  return lead.stage === "nouveau";
}

function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Tâche ouverte dont l'échéance est dépassée (en retard). */
export function isOverdue(lead: Lead, now: number = Date.now()): boolean {
  const due = lead.nextTask?.dueAt;
  if (!due) return false;
  const t = new Date(due).getTime();
  return !Number.isNaN(t) && t < now;
}

/**
 * Tâche à rappeler aujourd'hui : échéance dans la journée courante **et encore à
 * venir** (une échéance déjà dépassée relève de « en retard », pas de « à
 * rappeler aujourd'hui » — les deux files restent disjointes).
 */
export function isDueToday(lead: Lead, now: number = Date.now()): boolean {
  const due = lead.nextTask?.dueAt;
  if (!due) return false;
  const t = new Date(due).getTime();
  return !Number.isNaN(t) && t >= now && t <= endOfDay(now);
}

function matchesSearch(lead: Lead, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle.length === 0) return true;
  const haystack = [
    lead.contactFirstName,
    lead.contactLastName,
    lead.contactEmail,
    lead.contactPhone,
    lead.city,
    lead.postalCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Applique les filtres (rapides + recherche + stade). Fonction pure. */
export function applyLeadFilters(
  leads: Lead[],
  filters: LeadFilters,
  now: number = Date.now(),
): Lead[] {
  return leads.filter((lead) => {
    if (filters.stage && lead.stage !== filters.stage) return false;
    if (!matchesSearch(lead, filters.search)) return false;
    switch (filters.quick) {
      case "nouveau":
        return isNew(lead);
      case "non_affecte":
        return isUnassigned(lead);
      case "fort_potentiel":
        return isHighPotential(lead);
      case "a_rappeler":
        return isDueToday(lead, now);
      case "en_retard":
        return isOverdue(lead, now);
      case "tous":
      default:
        return true;
    }
  });
}

/** Tri stable des leads. Fonction pure. */
export function sortLeads(leads: Lead[], sort: LeadSort): Lead[] {
  const copy = [...leads];
  switch (sort) {
    case "ancien":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "priorite":
      return copy.sort(
        (a, b) =>
          (PRIORITY_WEIGHT[b.recommendedPriority ?? ""] ?? -1) -
            (PRIORITY_WEIGHT[a.recommendedPriority ?? ""] ?? -1) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    case "compatibilite":
      return copy.sort(
        (a, b) =>
          (b.compatibilityScore ?? -1) - (a.compatibilityScore ?? -1) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    case "maturite":
      return copy.sort(
        (a, b) =>
          (b.maturityScore ?? -1) - (a.maturityScore ?? -1) ||
          b.createdAt.localeCompare(a.createdAt),
      );
    case "recent":
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export interface OverviewMetrics {
  newToday: number;
  newLast7Days: number;
  unassigned: number;
  toRecallToday: number;
  overdueTasks: number;
  highPotential: number;
  contactRate: number | null; // % de leads ayant au moins un contact établi
  appointmentsPlanned: number;
  awaitingEligibility: number;
  mandatesProposed: number;
  mandatesSigned: number;
  total: number;
}

/**
 * Calcule les indicateurs de la vue d'ensemble à partir des leads (aucune
 * statistique fabriquée : tout est dérivé des données réelles). `contactedIds`
 * = opportunités ayant au moins une activité « contact établi ».
 */
export function computeOverviewMetrics(
  leads: Lead[],
  contactedOpportunityIds: Set<string>,
  now: number = Date.now(),
): OverviewMetrics {
  const dayStart = startOfDay(now);
  const weekStart = now - 7 * 24 * 3600 * 1000;

  let newToday = 0;
  let newLast7Days = 0;
  let unassigned = 0;
  let toRecallToday = 0;
  let overdueTasks = 0;
  let highPotential = 0;
  let appointmentsPlanned = 0;
  let awaitingEligibility = 0;
  let mandatesProposed = 0;
  let mandatesSigned = 0;

  for (const lead of leads) {
    const created = new Date(lead.createdAt).getTime();
    if (!Number.isNaN(created)) {
      if (created >= dayStart) newToday += 1;
      if (created >= weekStart) newLast7Days += 1;
    }
    if (isUnassigned(lead)) unassigned += 1;
    if (isDueToday(lead, now)) toRecallToday += 1;
    if (isOverdue(lead, now)) overdueTasks += 1;
    if (isHighPotential(lead)) highPotential += 1;
    if (lead.stage === "rendez_vous_planifie") appointmentsPlanned += 1;
    if (isAwaitingEligibility(lead)) awaitingEligibility += 1;
    if (
      lead.stage === "proposition_de_mandat" ||
      lead.stage === "en_attente_de_signature"
    )
      mandatesProposed += 1;
    if (lead.stage === "mandat_signe") mandatesSigned += 1;
  }

  const total = leads.length;
  const contactRate =
    total === 0 ? null : Math.round((contactedOpportunityIds.size / total) * 100);

  return {
    newToday,
    newLast7Days,
    unassigned,
    toRecallToday,
    overdueTasks,
    highPotential,
    contactRate,
    appointmentsPlanned,
    awaitingEligibility,
    mandatesProposed,
    mandatesSigned,
    total,
  };
}
