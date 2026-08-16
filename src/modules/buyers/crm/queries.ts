import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contactName } from "@/modules/crm/format";
import { maskContactValue } from "@/modules/crm/auth/roles";
import { getMembersMap, memberDisplayName, type MemberInfo } from "@/modules/crm/data/queries";
import { parseMatchResult } from "./matching";
import type { BuyerKanbanCard } from "./pipeline";
import type {
  ActivityRow,
  AuditEventRow,
  BuyerAssignmentRow,
  BuyerInterestRow,
  BuyerMatchResult,
  BuyerProfileRow,
  BuyerSearchCriteriaRow,
  ContactRow,
  PropertyRow,
  TaskRow,
} from "@/lib/supabase/types";

/**
 * Couche d'accès en LECTURE du CRM Acquéreurs. Toutes les requêtes passent par
 * le client serveur (JWT de l'utilisateur) : la **RLS PostgreSQL applique les
 * permissions** — un agent immobilier ne voit que ses dossiers, `partenaire_
 * lecture` n'a aucun accès en V1 (aucun mécanisme de partage acquéreur).
 *
 * On NE duplique PAS les données : on lit les tables existantes et on assemble
 * l'agrégat en mémoire (volumétrie faible), exactement comme le CRM Mandats.
 * Les coordonnées sensibles sont masquées **côté serveur** selon le rôle : le
 * navigateur ne reçoit jamais une valeur qu'il n'a pas le droit de voir.
 */

/** Agrégat d'un dossier acquéreur pour les listes (boîte de réception, Kanban). */
export interface BuyerListItem {
  profile: BuyerProfileRow;
  contact: ContactRow | null;
  name: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  city: string | null;
  /** Bien du dernier intérêt (contexte). */
  lastPropertyId: string | null;
  lastPropertyLabel: string | null;
  interestPropertyIds: string[];
  assignees: { userId: string; name: string; responsibility: string }[];
  nextTask: TaskRow | null;
  overdue: boolean;
  noNextAction: boolean;
  /** Au moins un intérêt encore au statut « nouveau ». */
  newInterest: boolean;
  /** Fourchette de budget recherchée (centimes). `null` = borne non renseignée. */
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
}

export interface BuyerListBundle {
  items: BuyerListItem[];
  members: Map<string, MemberInfo>;
  counters: {
    total: number;
    nouveaux: number;
    nonAffectes: number;
    enRetard: number;
    sansProchaineAction: number;
    fortPotentiel: number;
  };
}

function propertyLabelOf(p: PropertyRow | undefined): string | null {
  if (!p) return null;
  return p.commercial_title || p.project_name || "Bien sans nom";
}

/**
 * Charge tous les dossiers acquéreurs visibles avec leur contexte. Une seule
 * passe de requêtes, assemblage en mémoire.
 */
export async function loadBuyerList(canViewContacts: boolean): Promise<BuyerListBundle> {
  const supabase = await createSupabaseServerClient();

  const [
    { data: profiles },
    { data: contacts },
    { data: interests },
    { data: assignments },
    { data: openTasks },
    { data: properties },
    { data: criteria },
    members,
  ] = await Promise.all([
    supabase.from("buyer_profiles").select("*").order("last_interest_at", { ascending: false }),
    supabase.from("contacts").select("*"),
    supabase
      .from("buyer_interests")
      .select("*")
      .not("buyer_profile_id", "is", null)
      .order("created_at", { ascending: false }),
    supabase.from("buyer_assignments").select("*"),
    supabase
      .from("tasks")
      .select("*")
      .not("buyer_profile_id", "is", null)
      .eq("status", "a_faire")
      .order("due_at", { ascending: true }),
    supabase.from("properties").select("*"),
    supabase
      .from("buyer_search_criteria")
      .select("buyer_profile_id, budget_min_cents, budget_max_cents"),
    getMembersMap(),
  ]);

  const criteriaByProfile = new Map(
    ((criteria ?? []) as Pick<
      BuyerSearchCriteriaRow,
      "buyer_profile_id" | "budget_min_cents" | "budget_max_cents"
    >[]).map((c) => [c.buyer_profile_id, c]),
  );
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c as ContactRow]));
  const propertyById = new Map((properties ?? []).map((p) => [p.id, p as PropertyRow]));

  const interestsByProfile = new Map<string, BuyerInterestRow[]>();
  for (const raw of interests ?? []) {
    const i = raw as BuyerInterestRow;
    if (!i.buyer_profile_id) continue;
    const list = interestsByProfile.get(i.buyer_profile_id) ?? [];
    list.push(i);
    interestsByProfile.set(i.buyer_profile_id, list);
  }

  const assignmentsByProfile = new Map<string, BuyerAssignmentRow[]>();
  for (const raw of assignments ?? []) {
    const a = raw as BuyerAssignmentRow;
    const list = assignmentsByProfile.get(a.buyer_profile_id) ?? [];
    list.push(a);
    assignmentsByProfile.set(a.buyer_profile_id, list);
  }

  // Première tâche ouverte (déjà triée par échéance croissante).
  const nextTaskByProfile = new Map<string, TaskRow>();
  for (const raw of openTasks ?? []) {
    const t = raw as TaskRow;
    if (!t.buyer_profile_id) continue;
    if (!nextTaskByProfile.has(t.buyer_profile_id)) {
      nextTaskByProfile.set(t.buyer_profile_id, t);
    }
  }

  const now = Date.now();
  const items: BuyerListItem[] = (profiles ?? []).map((raw) => {
    const profile = raw as BuyerProfileRow;
    const contact = contactById.get(profile.contact_id) ?? null;
    const profileInterests = interestsByProfile.get(profile.id) ?? [];
    const last = profileInterests[0] ?? null;
    const lastProperty = last ? propertyById.get(last.property_id) : undefined;
    const nextTask = nextTaskByProfile.get(profile.id) ?? null;

    const assignees = (assignmentsByProfile.get(profile.id) ?? []).map((a) => ({
      userId: a.user_id,
      name: memberDisplayName(a.user_id, members),
      responsibility: a.responsibility,
    }));

    return {
      profile,
      contact,
      name: contactName(contact?.first_name ?? null, contact?.last_name ?? null),
      // Masquage CÔTÉ SERVEUR : la valeur réelle ne quitte jamais le serveur
      // pour un rôle non autorisé.
      emailMasked: maskContactValue(contact?.email ?? null, canViewContacts),
      phoneMasked: maskContactValue(contact?.phone ?? null, canViewContacts),
      city: lastProperty?.location_city ?? null,
      lastPropertyId: last?.property_id ?? null,
      lastPropertyLabel: propertyLabelOf(lastProperty),
      interestPropertyIds: [...new Set(profileInterests.map((i) => i.property_id))],
      assignees,
      nextTask,
      overdue: Boolean(nextTask?.due_at && new Date(nextTask.due_at).getTime() < now),
      noNextAction: nextTask == null,
      newInterest: profileInterests.some((i) => i.review_status === "nouveau"),
      budgetMinCents: criteriaByProfile.get(profile.id)?.budget_min_cents ?? null,
      budgetMaxCents: criteriaByProfile.get(profile.id)?.budget_max_cents ?? null,
    };
  });

  return {
    items,
    members,
    counters: {
      total: items.length,
      nouveaux: items.filter((i) => i.profile.pipeline_stage === "nouveau").length,
      nonAffectes: items.filter((i) => i.assignees.length === 0).length,
      enRetard: items.filter((i) => i.overdue).length,
      sansProchaineAction: items.filter((i) => i.noNextAction).length,
      fortPotentiel: items.filter((i) => i.profile.recommended_priority === "prioritaire")
        .length,
    },
  };
}

/**
 * Ligne de la boîte de réception, prête à sérialiser vers le navigateur.
 * DTO **délibérément réduit** : ni notes internes, ni motifs, ni réponses brutes
 * du funnel ne quittent le serveur pour alimenter une simple liste.
 */
export interface BuyerInboxRow {
  buyerProfileId: string;
  name: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  city: string | null;
  stage: string;
  qualificationStatus: string;
  recommendedPriority: string | null;
  bestScore: number | null;
  interestCount: number;
  lastInterestAt: string | null;
  createdAt: string;
  lastPropertyId: string | null;
  lastPropertyLabel: string | null;
  assigneeNames: string[];
  assigneeIds: string[];
  nextActionAt: string | null;
  nextActionTitle: string | null;
  overdue: boolean;
  noNextAction: boolean;
  newInterest: boolean;
  highPotential: boolean;
  unassigned: boolean;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
}

export function toInboxRow(item: BuyerListItem): BuyerInboxRow {
  return {
    buyerProfileId: item.profile.id,
    name: item.name,
    emailMasked: item.emailMasked,
    phoneMasked: item.phoneMasked,
    city: item.city,
    stage: item.profile.pipeline_stage,
    qualificationStatus: item.profile.qualification_status,
    recommendedPriority: item.profile.recommended_priority,
    bestScore: item.profile.best_overall_score,
    interestCount: item.profile.interest_count,
    lastInterestAt: item.profile.last_interest_at,
    createdAt: item.profile.created_at,
    lastPropertyId: item.lastPropertyId,
    lastPropertyLabel: item.lastPropertyLabel,
    assigneeNames: item.assignees.map((a) => a.name),
    assigneeIds: item.assignees.map((a) => a.userId),
    nextActionAt: item.nextTask?.due_at ?? null,
    nextActionTitle: item.nextTask?.title ?? null,
    overdue: item.overdue,
    noNextAction: item.noNextAction,
    newInterest: item.newInterest,
    highPotential: item.profile.recommended_priority === "prioritaire",
    unassigned: item.assignees.length === 0,
    budgetMinCents: item.budgetMinCents,
    budgetMaxCents: item.budgetMaxCents,
  };
}

/** Convertit un agrégat de liste en carte Kanban (DTO minimal, déjà masqué). */
export function toKanbanCard(item: BuyerListItem, qualificationLabel: string): BuyerKanbanCard {
  return {
    buyerProfileId: item.profile.id,
    stage: item.profile.pipeline_stage,
    name: item.name,
    propertyLabel: item.lastPropertyLabel,
    city: item.city,
    bestScore: item.profile.best_overall_score,
    recommendedPriority: item.profile.recommended_priority,
    qualificationLabel,
    interestCount: item.profile.interest_count,
    unassigned: item.assignees.length === 0,
    overdue: item.overdue,
    noNextAction: item.noNextAction,
    newInterest: item.newInterest,
    phoneMasked: item.phoneMasked,
  };
}

/** Intérêt enrichi de son bien, pour la fiche acquéreur et la Fabrique. */
export interface BuyerInterestWithProperty {
  interest: BuyerInterestRow;
  propertyLabel: string | null;
  propertyCity: string | null;
}

/** Détail complet d'un dossier acquéreur. */
export interface BuyerProfileDetail {
  profile: BuyerProfileRow;
  contact: ContactRow | null;
  name: string;
  /** Coordonnées déjà masquées selon le rôle. */
  email: string | null;
  phone: string | null;
  criteria: BuyerSearchCriteriaRow | null;
  interests: BuyerInterestWithProperty[];
  assignees: { userId: string; name: string; responsibility: string }[];
  tasks: TaskRow[];
  activities: ActivityRow[];
  auditEvents: AuditEventRow[];
  members: Map<string, MemberInfo>;
  offerPropertyLabel: string | null;
}

export async function getBuyerProfileDetail(
  buyerProfileId: string,
  canViewContacts: boolean,
): Promise<BuyerProfileDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data: profileRow } = await supabase
    .from("buyer_profiles")
    .select("*")
    .eq("id", buyerProfileId)
    .maybeSingle();
  // Absent OU non autorisé (RLS) : dans les deux cas, rien n'est révélé.
  if (!profileRow) return null;
  const profile = profileRow as BuyerProfileRow;

  const [
    { data: contactRow },
    { data: criteriaRow },
    { data: interestRows },
    { data: assignmentRows },
    { data: taskRows },
    { data: activityRows },
    { data: auditRows },
    members,
  ] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", profile.contact_id).maybeSingle(),
    supabase
      .from("buyer_search_criteria")
      .select("*")
      .eq("buyer_profile_id", buyerProfileId)
      .maybeSingle(),
    supabase
      .from("buyer_interests")
      .select("*")
      .eq("buyer_profile_id", buyerProfileId)
      .order("created_at", { ascending: false }),
    supabase.from("buyer_assignments").select("*").eq("buyer_profile_id", buyerProfileId),
    supabase
      .from("tasks")
      .select("*")
      .eq("buyer_profile_id", buyerProfileId)
      .order("due_at", { ascending: true }),
    supabase
      .from("activities")
      .select("*")
      .eq("buyer_profile_id", buyerProfileId)
      .order("occurred_at", { ascending: false }),
    // Le journal d'audit n'est lisible que par admin/manager (politique RLS) :
    // pour les autres rôles la requête renvoie simplement une liste vide.
    supabase
      .from("audit_events")
      .select("*")
      .eq("entity_type", "buyer_profile")
      .eq("entity_id", buyerProfileId)
      .order("created_at", { ascending: false }),
    getMembersMap(),
  ]);

  const interests = (interestRows ?? []) as BuyerInterestRow[];
  const propertyIds = [
    ...new Set([
      ...interests.map((i) => i.property_id),
      ...(profile.offer_property_id ? [profile.offer_property_id] : []),
    ]),
  ];
  const { data: propertyRows } = propertyIds.length
    ? await supabase.from("properties").select("*").in("id", propertyIds)
    : { data: [] };
  const propertyById = new Map(((propertyRows ?? []) as PropertyRow[]).map((p) => [p.id, p]));

  const contact = (contactRow as ContactRow | null) ?? null;

  return {
    profile,
    contact,
    name: contactName(contact?.first_name ?? null, contact?.last_name ?? null),
    email: maskContactValue(contact?.email ?? null, canViewContacts),
    phone: maskContactValue(contact?.phone ?? null, canViewContacts),
    criteria: (criteriaRow as BuyerSearchCriteriaRow | null) ?? null,
    interests: interests.map((interest) => {
      const p = propertyById.get(interest.property_id);
      return {
        interest,
        propertyLabel: propertyLabelOf(p),
        propertyCity: p?.location_city ?? null,
      };
    }),
    assignees: ((assignmentRows ?? []) as BuyerAssignmentRow[]).map((a) => ({
      userId: a.user_id,
      name: memberDisplayName(a.user_id, members),
      responsibility: a.responsibility,
    })),
    tasks: (taskRows ?? []) as TaskRow[],
    activities: (activityRows ?? []) as ActivityRow[],
    auditEvents: (auditRows ?? []) as AuditEventRow[],
    members,
    offerPropertyLabel: profile.offer_property_id
      ? propertyLabelOf(propertyById.get(profile.offer_property_id))
      : null,
  };
}

/**
 * Suggestions de biens pour un dossier. Le calcul est fait EN BASE (versionné,
 * déterministe, explicable) : on ne fait que valider la forme du résultat.
 */
export async function getBuyerMatches(
  buyerProfileId: string,
  limit = 10,
): Promise<BuyerMatchResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_buyer_property_matches", {
    p_buyer_profile_id: buyerProfileId,
    p_limit: limit,
  });
  if (error) return parseMatchResult(null);
  return parseMatchResult(data);
}

/** Dossiers acquéreurs ayant manifesté un intérêt sur un bien donné (Fabrique). */
export interface PropertyBuyerRow {
  profile: BuyerProfileRow;
  name: string;
  phoneMasked: string | null;
  emailMasked: string | null;
  interest: BuyerInterestRow;
  assigneeNames: string[];
}

export async function listBuyersForProperty(
  propertyId: string,
  canViewContacts: boolean,
): Promise<PropertyBuyerRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data: interestRows } = await supabase
    .from("buyer_interests")
    .select("*")
    .eq("property_id", propertyId)
    .not("buyer_profile_id", "is", null)
    .order("created_at", { ascending: false });

  const interests = (interestRows ?? []) as BuyerInterestRow[];
  const profileIds = [
    ...new Set(interests.map((i) => i.buyer_profile_id).filter((v): v is string => Boolean(v))),
  ];
  if (profileIds.length === 0) return [];

  const [{ data: profileRows }, { data: assignmentRows }, members] = await Promise.all([
    supabase.from("buyer_profiles").select("*").in("id", profileIds),
    supabase.from("buyer_assignments").select("*").in("buyer_profile_id", profileIds),
    getMembersMap(),
  ]);

  const profiles = (profileRows ?? []) as BuyerProfileRow[];
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const contactIds = [...new Set(profiles.map((p) => p.contact_id))];
  const { data: contactRows } = contactIds.length
    ? await supabase.from("contacts").select("*").in("id", contactIds)
    : { data: [] };
  const contactById = new Map(((contactRows ?? []) as ContactRow[]).map((c) => [c.id, c]));

  const assigneesByProfile = new Map<string, string[]>();
  for (const a of ((assignmentRows ?? []) as BuyerAssignmentRow[])) {
    const list = assigneesByProfile.get(a.buyer_profile_id) ?? [];
    list.push(memberDisplayName(a.user_id, members));
    assigneesByProfile.set(a.buyer_profile_id, list);
  }

  // Un seul dossier par personne : on garde l'intérêt le plus récent par dossier.
  const seen = new Set<string>();
  const rows: PropertyBuyerRow[] = [];
  for (const interest of interests) {
    const pid = interest.buyer_profile_id;
    if (!pid || seen.has(pid)) continue;
    const profile = profileById.get(pid);
    if (!profile) continue; // non visible pour ce rôle (RLS)
    seen.add(pid);
    const contact = contactById.get(profile.contact_id) ?? null;
    rows.push({
      profile,
      name: contactName(contact?.first_name ?? null, contact?.last_name ?? null),
      phoneMasked: maskContactValue(contact?.phone ?? null, canViewContacts),
      emailMasked: maskContactValue(contact?.email ?? null, canViewContacts),
      interest,
      assigneeNames: assigneesByProfile.get(pid) ?? [],
    });
  }
  return rows;
}
