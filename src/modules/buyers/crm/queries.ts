import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  prochaineAction,
  type ProchaineAction,
  type TacheOuverte,
} from "./prochaine-action";
import { contactName } from "@/modules/crm/format";
import { maskContactValue } from "@/modules/crm/auth/roles";
import { getMembersMap, memberDisplayName, type MemberInfo } from "@/modules/crm/data/queries";
import type { BuyerKanbanCard } from "./pipeline";
import type {
  ActivityRow,
  AuditEventRow,
  BuyerAssignmentRow,
  BuyerInterestRow,
  BuyerProfileRow,
  BuyerQualification,
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

/**
 * Une ligne de travail du CRM Acquéreurs : UNE personne SUR UN PROJET.
 *
 * C'était auparavant un dossier par personne, toutes manifestations
 * confondues. Quelqu'un qui s'intéresse à Villa Verdun ET à Villa Jean Jaurès
 * n'apparaissait qu'une fois, avec une seule étape commerciale : caler une
 * visite à Verdun déplaçait aussi son intérêt Jean Jaurès, et le pipeline
 * global ne pouvait pas dire de quel projet une carte parlait.
 *
 * La fiche CONTACT reste unique — c'est la même personne, ses coordonnées ne
 * sont pas dupliquées. Seul le SUIVI commercial se dédouble.
 */
export interface BuyerListItem {
  profile: BuyerProfileRow;
  /** Manifestation d'intérêt que cette ligne représente. */
  interestId: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  /**
   * Étape de CETTE manifestation. Un dossier clos au niveau de la personne
   * (gagné / perdu) ferme toutes ses manifestations : on ne gagne pas un
   * acquéreur sur un projet en le laissant « nouveau » sur un autre. La règle
   * est appliquée ici, en un seul endroit.
   */
  stage: string;
  contact: ContactRow | null;
  name: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  city: string | null;
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
  /** Réponse au questionnaire du dernier intérêt (`budget_choice`). */
  budgetChoice: string | null;
  /**
   * Jugement commercial sur CE projet. Il ne se déduit de rien : ni du budget
   * déclaré, ni d'un appel sans réponse. C'est lui — et lui seul — qui colore
   * la ligne.
   */
  qualification: BuyerQualification;
  qualificationReason: string | null;
  /** Appels consignés sur CE projet. Un message envoyé n'en est pas un. */
  callAttempts: number;
  lastCallAt: string | null;
  lastCallOutcome: string | null;
  lastNote: string | null;
  lastNoteAt: string | null;
  lastNoteBy: string | null;
  /** Numéro signalé invalide : ce dossier sort de la file d'appels. */
  phoneInvalid: boolean;
}

/** Un projet du sélecteur de navigation. */
export interface ProjetAccessible {
  id: string;
  label: string;
  city: string | null;
}

export interface BuyerListBundle {
  items: BuyerListItem[];
  members: Map<string, MemberInfo>;
  /**
   * Les projets auxquels l'utilisateur a accès, lus sous RLS — jamais une liste
   * écrite dans le code. Un projet qui lui est confié apparaît donc dès qu'il
   * existe, MÊME SANS AUCUN DOSSIER : c'est à ça que sert une barre de
   * navigation. La dériver des dossiers l'aurait rendue invisible le jour de son
   * lancement, exactement quand on la regarde.
   */
  projets: ProjetAccessible[];
  /**
   * Instant de chargement (ISO). Les composants qui raisonnent sur « ce qui est
   * en retard » ou « les trente derniers jours » le lisent ici plutôt que
   * d'interroger l'horloge pendant leur rendu : côté client, un rendu serveur
   * et un rendu navigateur séparés par un passage de minuit ne donneraient pas
   * le même graphique, et l'hydratation casserait.
   */
  chargeA: string;
  /** Vrai si le plafond a été atteint : il reste des dossiers non chargés. */
  tronquee: boolean;
  counters: {
    total: number;
    nouveaux: number;
    nonAffectes: number;
    enRetard: number;
    sansProchaineAction: number;
    grosPotentiel: number;
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
/**
 * Plafond de chargement. Il ne sert pas à « faire joli » : sans lui, chaque
 * rendu de la liste lit l'intégralité des dossiers, des contacts et des
 * activités — et il y a plusieurs rendus par interaction.
 *
 * Il est volontairement HAUT et volontairement VISIBLE : `tronquee` remonte
 * jusqu'à l'écran. Tronquer une liste de leads sans le dire serait pire que
 * lent — le commercial travaillerait sur un sous-ensemble sans le savoir.
 */
export const PLAFOND_LISTE = 2000;

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
    { data: activityByInterest },
  ] = await Promise.all([
    supabase
      .from("buyer_profiles")
      .select("*")
      .order("last_interest_at", { ascending: false })
      .limit(PLAFOND_LISTE),
    supabase.from("contacts").select("*").limit(PLAFOND_LISTE),
    supabase
      .from("buyer_interests")
      .select("*")
      .not("buyer_profile_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(PLAFOND_LISTE),
    supabase.from("buyer_assignments").select("*").limit(PLAFOND_LISTE),
    supabase
      .from("tasks")
      .select("*")
      .not("buyer_profile_id", "is", null)
      .eq("status", "a_faire")
      .order("due_at", { ascending: true })
      .limit(PLAFOND_LISTE),
    supabase.from("properties").select("*"),
    supabase
      .from("buyer_search_criteria")
      .select("buyer_profile_id, budget_min_cents, budget_max_cents")
      .limit(PLAFOND_LISTE),
    getMembersMap(),
    // Tentatives, dernier appel et dernière note : agrégés EN BASE. Rapatrier
    // toutes les activités ferait grossir la charge avec le nombre d'appels
    // passés, pour afficher deux nombres et une phrase.
    supabase.from("crm_buyer_interest_activity").select("*").limit(PLAFOND_LISTE),
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

  /*
   * Première tâche ouverte (déjà triée par échéance croissante).
   *
   * Une tâche rattachée à une manifestation (une visite, par exemple) ne vaut
   * QUE pour ce projet : sans cette distinction, caler une visite à Verdun
   * aurait donné « prochaine action : visite » à la ligne Jean Jaurès de la
   * même personne. Une tâche sans manifestation est un suivi général : elle
   * vaut pour toutes ses lignes.
   */
  const tachesParManifestation = new Map<string, TaskRow>();
  const tachesGenerales = new Map<string, TaskRow>();
  for (const raw of openTasks ?? []) {
    const t = raw as TaskRow;
    if (!t.buyer_profile_id) continue;
    if (t.interest_id) {
      if (!tachesParManifestation.has(t.interest_id)) {
        tachesParManifestation.set(t.interest_id, t);
      }
    } else if (!tachesGenerales.has(t.buyer_profile_id)) {
      tachesGenerales.set(t.buyer_profile_id, t);
    }
  }

  /** La plus proche entre la tâche du projet et le suivi général. */
  function nextTaskPour(profileId: string, interestId: string | null): TaskRow | null {
    const duProjet = interestId ? tachesParManifestation.get(interestId) ?? null : null;
    const generale = tachesGenerales.get(profileId) ?? null;
    if (!duProjet) return generale;
    if (!generale) return duProjet;
    return (duProjet.due_at ?? "9999") <= (generale.due_at ?? "9999") ? duProjet : generale;
  }

  /** Résumé d'historique par manifestation, tel que la base l'a agrégé. */
  interface ResumeActivite {
    interest_id: string;
    call_attempts: number | null;
    last_call_at: string | null;
    last_call_outcome: string | null;
    last_note: string | null;
    last_note_at: string | null;
    last_note_by: string | null;
  }
  const activiteParManifestation = new Map<string, ResumeActivite>(
    ((activityByInterest ?? []) as ResumeActivite[]).map((a) => [a.interest_id, a]),
  );

  const now = Date.now();
  const items: BuyerListItem[] = [];

  for (const raw of profiles ?? []) {
    const profile = raw as BuyerProfileRow;
    const contact = contactById.get(profile.contact_id) ?? null;
    const profileInterests = interestsByProfile.get(profile.id) ?? [];
    const tousBiens = [...new Set(profileInterests.map((i) => i.property_id))];

    const assignees = (assignmentsByProfile.get(profile.id) ?? []).map((a) => ({
      userId: a.user_id,
      name: memberDisplayName(a.user_id, members),
      responsibility: a.responsibility,
    }));

    const identite = {
      profile,
      contact,
      name: contactName(contact?.first_name ?? null, contact?.last_name ?? null),
      // Masquage CÔTÉ SERVEUR : la valeur réelle ne quitte jamais le serveur
      // pour un rôle non autorisé.
      emailMasked: maskContactValue(contact?.email ?? null, canViewContacts),
      phoneMasked: maskContactValue(contact?.phone ?? null, canViewContacts),
      interestPropertyIds: tousBiens,
      assignees,
      budgetMinCents: criteriaByProfile.get(profile.id)?.budget_min_cents ?? null,
      budgetMaxCents: criteriaByProfile.get(profile.id)?.budget_max_cents ?? null,
    };

    // Un dossier sans aucune manifestation ne devrait pas exister (il naît
    // d'une manifestation). S'il en existe un, il garde une ligne plutôt que
    // de disparaître silencieusement de la liste.
    if (profileInterests.length === 0) {
      const nextTask = nextTaskPour(profile.id, null);
      items.push({
        ...identite,
        interestId: null,
        propertyId: null,
        propertyLabel: null,
        stage: profile.outcome ?? profile.pipeline_stage,
        city: null,
        nextTask,
        overdue: Boolean(nextTask?.due_at && new Date(nextTask.due_at).getTime() < now),
        noNextAction: nextTask == null,
        newInterest: false,
        budgetChoice: null,
        qualification: "a_qualifier",
        qualificationReason: null,
        callAttempts: 0,
        lastCallAt: null,
        lastCallOutcome: null,
        lastNote: null,
        lastNoteAt: null,
        lastNoteBy: null,
        phoneInvalid: contact?.phone_status === "invalide",
      });
      continue;
    }

    for (const interet of profileInterests) {
      const property = propertyById.get(interet.property_id);
      const nextTask = nextTaskPour(profile.id, interet.id);
      const activite = activiteParManifestation.get(interet.id);
      items.push({
        ...identite,
        interestId: interet.id,
        propertyId: interet.property_id,
        propertyLabel: propertyLabelOf(property),
        // Un dossier clos au niveau de la personne ferme toutes ses
        // manifestations : la règle vit ici, en un seul endroit.
        stage: profile.outcome ?? interet.pipeline_stage,
        city: property?.location_city ?? null,
        nextTask,
        overdue: Boolean(nextTask?.due_at && new Date(nextTask.due_at).getTime() < now),
        noNextAction: nextTask == null,
        newInterest: interet.review_status === "nouveau",
        // Le budget DÉCLARÉ vient de la réponse au questionnaire de CETTE
        // manifestation : c'est la seule qu'on ait pour un lead du funnel.
        budgetChoice: interet.budget_choice ?? null,
        qualification: interet.qualification,
        qualificationReason: interet.qualification_reason,
        callAttempts: activite?.call_attempts ?? 0,
        lastCallAt: activite?.last_call_at ?? null,
        lastCallOutcome: activite?.last_call_outcome ?? null,
        lastNote: activite?.last_note ?? null,
        lastNoteAt: activite?.last_note_at ?? null,
        lastNoteBy: activite?.last_note_by ?? null,
        // Le numéro appartient à la PERSONNE : invalide ici, invalide partout.
        phoneInvalid: contact?.phone_status === "invalide",
      });
    }
  }

  const projets: ProjetAccessible[] = ((properties ?? []) as PropertyRow[])
    .map((p) => ({
      id: p.id,
      label: propertyLabelOf(p) ?? "Bien sans nom",
      city: p.location_city ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  return {
    items,
    members,
    projets,
    chargeA: new Date(now).toISOString(),
    tronquee: (profiles ?? []).length >= PLAFOND_LISTE,
    counters: {
      total: items.length,
      nouveaux: items.filter((i) => i.profile.pipeline_stage === "nouveau").length,
      nonAffectes: items.filter((i) => i.assignees.length === 0).length,
      enRetard: items.filter((i) => i.overdue).length,
      sansProchaineAction: items.filter((i) => i.noNextAction).length,
      /* « Gros potentiel » est désormais un JUGEMENT, posé au téléphone, et
         non plus une recommandation calculée à partir des réponses du
         formulaire. Les deux portaient le même nom et ne disaient pas la
         même chose. */
      grosPotentiel: items.filter((i) => i.qualification === "gros_potentiel").length,
    },
  };
}

/**
 * Ligne de la boîte de réception, prête à sérialiser vers le navigateur.
 * DTO **délibérément réduit** : ni notes internes, ni motifs, ni réponses brutes
 * du funnel ne quittent le serveur pour alimenter une simple liste.
 */
export interface BuyerInboxRow {
  /** Clé de la LIGNE : une personne sur un projet. Deux lignes de la même
      personne sur deux projets ne doivent pas se confondre. */
  interestId: string | null;
  buyerProfileId: string;
  name: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  city: string | null;
  stage: string;
  /* `qualificationStatus` (ancienne échelle par personne), `recommendedPriority`
     et `bestScore` ne quittent plus le serveur : ils disaient une deuxième, une
     troisième et une quatrième fois « où en est ce lead », sans que personne ne
     les ait posés. Les colonnes restent en base. */
  interestCount: number;
  lastInterestAt: string | null;
  createdAt: string;
  propertyId: string | null;
  propertyLabel: string | null;
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
  budgetChoice: string | null;
  /** C'est elle, et elle seule, qui colore la ligne. */
  qualification: BuyerQualification;
  qualificationReason: string | null;
  callAttempts: number;
  lastCallAt: string | null;
  lastCallOutcome: string | null;
  lastNote: string | null;
  lastNoteAt: string | null;
  lastNoteBy: string | null;
  phoneInvalid: boolean;
  /** Rappel ouvert à solder quand ce dossier est traité. */
  nextActionId: string | null;
  nextActionKind: string | null;
}

export function toInboxRow(item: BuyerListItem): BuyerInboxRow {
  return {
    interestId: item.interestId,
    buyerProfileId: item.profile.id,
    name: item.name,
    emailMasked: item.emailMasked,
    phoneMasked: item.phoneMasked,
    city: item.city,
    stage: item.stage,
    interestCount: item.profile.interest_count,
    lastInterestAt: item.profile.last_interest_at,
    createdAt: item.profile.created_at,
    propertyId: item.propertyId,
    propertyLabel: item.propertyLabel,
    assigneeNames: item.assignees.map((a) => a.name),
    assigneeIds: item.assignees.map((a) => a.userId),
    nextActionAt: item.nextTask?.due_at ?? null,
    nextActionTitle: item.nextTask?.title ?? null,
    nextActionId: item.nextTask?.id ?? null,
    nextActionKind: item.nextTask?.kind ?? null,
    qualification: item.qualification,
    qualificationReason: item.qualificationReason,
    callAttempts: item.callAttempts,
    lastCallAt: item.lastCallAt,
    lastCallOutcome: item.lastCallOutcome,
    lastNote: item.lastNote,
    lastNoteAt: item.lastNoteAt,
    lastNoteBy: item.lastNoteBy,
    phoneInvalid: item.phoneInvalid,
    overdue: item.overdue,
    noNextAction: item.noNextAction,
    newInterest: item.newInterest,
    highPotential: item.qualification === "gros_potentiel",
    unassigned: item.assignees.length === 0,
    budgetMinCents: item.budgetMinCents,
    budgetMaxCents: item.budgetMaxCents,
    budgetChoice: item.budgetChoice,
  };
}

/**
 * Convertit un agrégat de liste en carte Kanban (DTO minimal, déjà masqué).
 *
 * La carte porte EXACTEMENT les champs sur lesquels la liste filtre. C'est la
 * condition pour que les deux vues soient deux vues des mêmes dossiers : tant
 * que le Kanban avait ses propres onglets sur ses propres champs, passer de
 * l'une à l'autre changeait le nombre de dossiers sans que rien ne l'explique.
 */
export function toKanbanCard(item: BuyerListItem): BuyerKanbanCard {
  return {
    interestId: item.interestId,
    propertyId: item.propertyId,
    buyerProfileId: item.profile.id,
    stage: item.stage,
    name: item.name,
    propertyLabel: item.propertyLabel,
    city: item.city,
    emailMasked: item.emailMasked,
    phoneMasked: item.phoneMasked,
    qualification: item.qualification,
    callAttempts: item.callAttempts,
    nextActionAt: item.nextTask?.due_at ?? null,
    assigneeIds: item.assignees.map((a) => a.userId),
    budgetMinCents: item.budgetMinCents,
    budgetMaxCents: item.budgetMaxCents,
    interestCount: item.profile.interest_count,
    unassigned: item.assignees.length === 0,
    overdue: item.overdue,
    noNextAction: item.noNextAction,
    newInterest: item.newInterest,
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
  /**
   * LA prochaine action, calculée par le module partagé — le même que la
   * liste, le Kanban, le cockpit du bien et le tableau de bord.
   *
   * La fiche avait sa propre règle (toute tâche non « faite » ni « annulée »,
   * échéance ou pas), la liste la sienne (statut « à faire » strictement) :
   * un même dossier pouvait annoncer deux choses différentes selon l'écran.
   */
  prochaine: ProchaineAction | null;
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

  const tasks = (taskRows ?? []) as TaskRow[];
  /* Sur la fiche d'une personne, on ne filtre pas sur un projet : on montre la
     plus proche, tous projets confondus. L'heure est lue ICI, dans la requête,
     et non pendant le rendu — un composant qui lit l'horloge n'est pas
     reproductible, et React le refuse à juste titre. */
  const prochaine = prochaineAction(tasks as TacheOuverte[], null, Date.now());

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
    tasks,
    prochaine,
    activities: (activityRows ?? []) as ActivityRow[],
    auditEvents: (auditRows ?? []) as AuditEventRow[],
    members,
    offerPropertyLabel: profile.offer_property_id
      ? propertyLabelOf(propertyById.get(profile.offer_property_id))
      : null,
  };
}


/** Dossiers acquéreurs ayant manifesté un intérêt sur un bien donné (Fabrique). */
export interface PropertyBuyerRow {
  profile: BuyerProfileRow;
  name: string;
  phoneMasked: string | null;
  emailMasked: string | null;
  interest: BuyerInterestRow;
  assigneeNames: string[];
  /* Les deux memes informations que partout ailleurs : ce qui s'est passe au
     dernier appel, et ce qui est prevu ensuite. Le cockpit affichait a la
     place deux scores en centiemes et un statut « Non traite / Consulte /
     Traite » qui n'existait que sur cet ecran. */
  lastCallOutcome: string | null;
  nextActionAt: string | null;
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

  const interestIds = interests.map((i) => i.id);
  const [
    { data: profileRows },
    { data: assignmentRows },
    members,
    { data: activityRows },
    { data: taskRows },
  ] = await Promise.all([
    supabase.from("buyer_profiles").select("*").in("id", profileIds),
    supabase.from("buyer_assignments").select("*").in("buyer_profile_id", profileIds),
    getMembersMap(),
    // Agrege EN BASE : rapatrier toutes les activites pour afficher un libelle
    // ferait grossir la charge avec le nombre d'appels passes.
    supabase.from("crm_buyer_interest_activity").select("*").in("interest_id", interestIds),
    supabase
      .from("tasks")
      .select("*")
      .in("buyer_profile_id", profileIds)
      .eq("status", "a_faire")
      .order("due_at", { ascending: true }),
  ]);

  const dernierAppel = new Map<string, string | null>(
    ((activityRows ?? []) as { interest_id: string; last_call_outcome: string | null }[]).map(
      (a) => [a.interest_id, a.last_call_outcome],
    ),
  );

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
      lastCallOutcome: dernierAppel.get(interest.id) ?? null,
      /* La MEME definition que la liste : la tache du projet si elle existe,
         sinon le suivi general de la personne, et la plus proche des deux. */
      nextActionAt:
        prochaineAction(
          ((taskRows ?? []) as TacheOuverte[]).filter((t) => t.buyer_profile_id === pid),
          interest.id,
          Date.now(),
        )?.dueAt ?? null,
    });
  }
  return rows;
}
