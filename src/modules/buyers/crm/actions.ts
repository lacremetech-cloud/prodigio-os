"use server";

import { revalidatePath } from "next/cache";
import { messageUtilisateur as humanize } from "./erreurs";
import { after } from "next/server";
import { z } from "zod";
import {
  ETAPES_ACCEPTEES_EN_ECRITURE,
  etape as definitionEtape,
} from "./vocabulaire";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canDecideMandate } from "@/modules/crm/auth/roles";
import { evaluateBuyerMove } from "./pipeline";
import {
  conversionInscriptionTerminee,
  conversionRendezVous,
} from "@/modules/analytics/meta/conversions";

/**
 * Actions serveur de MUTATION du CRM Acquéreurs. Elles délèguent aux fonctions
 * SQL `crm_buyer_*` (SECURITY DEFINER) qui re-vérifient le rôle, appliquent les
 * règles métier et écrivent l'AuditEvent : **la base fait autorité**.
 *
 * On ajoute ici une garde de session (défense en profondeur), la validation Zod
 * à la frontière et l'invalidation du cache. Aucune donnée technique, aucun
 * secret, aucune note interne n'est renvoyé au navigateur.
 *
 * Ce qui n'est JAMAIS accepté depuis le navigateur : un score, une priorité
 * recommandée, un résultat de matching. Ces valeurs sont calculées en base.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Action métier dédiée à ouvrir quand un déplacement est refusé. */
  requiresAction?: "offre" | "resultat" | "reouverture";
}

/* La traduction vit dans `erreurs.ts` : ce fichier porte « use server » et ne
   peut exporter que des fonctions asynchrones, donc rien d'ici n'est testable
   directement. Le nom local reste `humanize` pour ne pas toucher aux dix-huit
   appels. */

/**
 * Lance un effet de bord APRES la reponse : une remontee de conversion ne doit
 * jamais retarder l'action du commercial ni la faire echouer. Toute erreur est
 * avalee ici — c'est de la mesure, pas du metier.
 */
function enArrierePlan(travail: () => Promise<unknown>): void {
  const sur = async () => {
    try {
      await travail();
    } catch (cause) {
      console.warn("effet differe en echec", {
        name: cause instanceof Error ? cause.name : "unknown",
      });
    }
  };
  try {
    after(() => sur());
  } catch {
    void sur();
  }
}

function revalidateBuyer(buyerProfileId?: string) {
  revalidatePath("/crm/acquereurs");
  revalidatePath("/crm/acquereurs/pipeline");
  if (buyerProfileId) revalidatePath(`/crm/acquereurs/${buyerProfileId}`);
}

const uuid = z.string().uuid("Identifiant invalide.");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

// --- Étape du pipeline --------------------------------------------------------
const stageSchema = z.object({
  buyerProfileId: uuid,
  /**
   * Manifestation concernée. L'étape vivait sur la PERSONNE : caler une visite
   * sur un projet déplaçait aussi ses autres intérêts. Elle vit désormais sur
   * la manifestation, et c'est elle qu'on déplace.
   */
  interestId: uuid,
  /* TOUTES les étapes du pipeline, lues depuis le vocabulaire commun.
     Cette ligne portait sa propre liste, figée au vocabulaire d'avant la
     reprise du 14 octobre : « a_contacter », « visite_planifiee »,
     « pas_interesse » et « mauvais_numero » n'y figuraient pas. Quatre
     colonnes sur sept refusaient donc le dépôt, en renvoyant vers une
     « action dédiée » supprimée depuis. Le commercial lisait un refus qui
     n'avait plus aucune raison d'être, et croyait l'outil ainsi conçu.
     Dériver la liste du vocabulaire rend cette dérive impossible. */
  stage: z.enum(ETAPES_ACCEPTEES_EN_ECRITURE),
});

export async function setBuyerStageAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      /* Plus aucune étape n'est « réservée » : si l'on arrive ici, c'est que
         la valeur est réellement inconnue, pas qu'elle est protégée. */
      error: "Étape inconnue.",
    };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_set_interest_stage", {
    p_interest_id: parsed.data.interestId,
    p_stage: parsed.data.stage,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  /* Normalisée AVANT comparaison. Les deux tests ci-dessous portaient le nom
     brut : « visite » n'existe plus depuis la reprise — l'étape s'appelle
     « visite_planifiee » — et la conversion « rendez-vous programmé » n'est
     donc plus partie une seule fois depuis le 14 octobre. Une comparaison de
     chaîne qui échoue ne lève pas : elle se tait, et c'est pour ça que
     personne ne l'a vue. */
  const etapeReelle = definitionEtape(parsed.data.stage).valeur;

  if (etapeReelle === "en_discussion") {
    /* Conversion « inscription terminee ». Elle etait accrochee a la
       qualification, retiree de la fiche : un dossier etait qualifie deux fois,
       une fois par son etape et une fois par un statut separe. L'equivalent
       honnete est l'entree en discussion — quelqu'un a repondu, c'est une vraie
       conversation, et c'est une decision humaine, jamais un score. */
    enArrierePlan(() => conversionInscriptionTerminee(supabase, parsed.data.interestId));
  }
  if (etapeReelle === "visite_planifiee") {
    // Conversion « rendez-vous programme » : le fait metier, c'est l'entree en
    // visite. L'identifiant d'evenement porte la date, si bien qu'un aller-
    // retour de carte dans la meme journee ne compte pas deux fois.
    enArrierePlan(() => conversionRendezVous(supabase, parsed.data.interestId));
  }
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

/**
 * Déplacement d'une carte du Kanban Acquéreurs : ré-applique la règle de
 * progression (cibles protégées refusées) AVANT d'appeler la mutation serveur.
 * Défense en profondeur — la base re-vérifie tout — et permet d'orienter
 * l'utilisateur vers la bonne action métier plutôt que d'afficher une erreur
 * brute. Renvoie `requiresAction` à cette fin.
 */
export async function moveBuyerCardAction(input: {
  buyerProfileId: string;
  interestId: string;
  fromStage: string;
  toStage: string;
}): Promise<ActionResult> {
  const evaluation = evaluateBuyerMove(input.fromStage, input.toStage);
  if (evaluation.noop) return { ok: true };
  if (!evaluation.allowed) {
    return {
      ok: false,
      error: evaluation.reason ?? "Déplacement non autorisé.",
      requiresAction: evaluation.requiresAction,
    };
  }
  return setBuyerStageAction({
    buyerProfileId: input.buyerProfileId,
    interestId: input.interestId,
    stage: input.toStage,
  });
}

// --- Qualification HUMAINE ----------------------------------------------------
const qualifySchema = z.object({
  buyerProfileId: uuid,
  status: z.enum(["non_qualifie", "en_cours", "qualifie", "ecarte"]),
  reason: optionalText(2000),
});

export async function qualifyBuyerAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = qualifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  if (d.status === "ecarte" && !d.reason?.trim()) {
    return { ok: false, error: "Un motif est requis pour écarter un dossier." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_qualify", {
    p_buyer_profile_id: d.buyerProfileId,
    p_status: d.status,
    p_reason: d.reason ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

// --- Affectation --------------------------------------------------------------
const assignSchema = z.object({
  buyerProfileId: uuid,
  userId: uuid,
  responsibility: z
    .enum(["setter", "manager", "agent_immobilier", "responsable_marketing"])
    .default("setter"),
});

export async function assignBuyerAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_assign", {
    p_buyer_profile_id: d.buyerProfileId,
    p_user_id: d.userId,
    p_responsibility: d.responsibility,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

/**
 * « M'attribuer ce lead ».
 *
 * Passe par `crm_buyer_claim` et NON par `crm_buyer_assign` : prendre un
 * dossier libre et réaffecter celui d'un collègue sont deux actes différents.
 * Le second reste réservé à l'encadrement — sans quoi deux associés pourraient
 * se reprendre leurs dossiers sans que l'autre le sache.
 *
 * Un dossier déjà suivi ne lève pas d'erreur : la fonction RENVOIE le nom du
 * responsable, pour qu'on l'affiche. « Jean-Charles suit déjà ce dossier » dit
 * quoi faire ; « droits insuffisants » ne dit rien.
 */
export async function selfAssignBuyerAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z.object({ buyerProfileId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_buyer_claim", {
    p_buyer_profile_id: parsed.data.buyerProfileId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  const reponse = (data ?? {}) as {
    ok?: boolean;
    raison?: string;
    responsable_nom?: string | null;
  };
  if (reponse.ok === false) {
    /* La liste est rafraîchie DANS les deux cas : celui qui perd la course doit
       voir le responsable apparaître, pas seulement lire qu'il a perdu. */
    revalidateBuyer(parsed.data.buyerProfileId);
    const nom = reponse.responsable_nom?.trim();
    return {
      ok: false,
      error: nom
        ? `${nom} suit déjà ce dossier.`
        : "Ce dossier a déjà un responsable.",
    };
  }

  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

/**
 * Rendre un dossier qu'on suit soi-même.
 *
 * Sans cela, un clic malheureux serait définitif pour un commercial : il
 * devrait demander à l'agence de lui retirer un dossier qu'il vient de
 * prendre. Rendre LE SIEN ne touche à l'organisation de personne, et la ligne
 * d'affectation est conservée, datée comme rendue.
 */
export async function releaseBuyerAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z.object({ buyerProfileId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("crm_buyer_release", {
    p_buyer_profile_id: parsed.data.buyerProfileId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  const reponse = (data ?? {}) as { ok?: boolean };
  if (reponse.ok === false) {
    return { ok: false, error: "Ce dossier n'est pas le vôtre." };
  }
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

export async function unassignBuyerAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z.object({ buyerProfileId: uuid, userId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_unassign", {
    p_buyer_profile_id: parsed.data.buyerProfileId,
    p_user_id: parsed.data.userId,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

// --- Critères de recherche (saisie humaine) -----------------------------------
const criteriaSchema = z.object({
  buyerProfileId: uuid,
  propertyTypes: z.array(z.string().trim().min(1).max(60)).max(20).nullable().optional(),
  locations: z.array(z.string().trim().min(1).max(120)).max(30).nullable().optional(),
  // Saisie en euros côté interface, convertie en centimes ici.
  budgetMinEuros: z.number().min(0).max(1_000_000_000).nullable().optional(),
  budgetMaxEuros: z.number().min(0).max(1_000_000_000).nullable().optional(),
  purchaseHorizon: optionalText(60),
  financing: optionalText(60),
  projectNature: optionalText(60),
  decisionMode: optionalText(60),
  notes: optionalText(4000),
});

export async function upsertBuyerCriteriaAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = criteriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  if (
    d.budgetMinEuros != null &&
    d.budgetMaxEuros != null &&
    d.budgetMaxEuros < d.budgetMinEuros
  ) {
    return { ok: false, error: "Le budget maximal doit être supérieur au budget minimal." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_upsert_criteria", {
    p_buyer_profile_id: d.buyerProfileId,
    p_property_types: d.propertyTypes ?? null,
    p_locations: d.locations ?? null,
    p_budget_min_cents: d.budgetMinEuros == null ? null : Math.round(d.budgetMinEuros * 100),
    p_budget_max_cents: d.budgetMaxEuros == null ? null : Math.round(d.budgetMaxEuros * 100),
    p_purchase_horizon: d.purchaseHorizon ?? null,
    p_financing: d.financing ?? null,
    p_project_nature: d.projectNature ?? null,
    p_decision_mode: d.decisionMode ?? null,
    p_notes: d.notes ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

// --- Offre en cours (action métier dédiée) ------------------------------------
const offerSchema = z.object({
  buyerProfileId: uuid,
  propertyId: uuid.nullable().optional(),
  amountEuros: z.number().min(0).max(1_000_000_000).nullable().optional(),
  note: optionalText(4000),
});

export async function recordBuyerOfferAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_record_offer", {
    p_buyer_profile_id: d.buyerProfileId,
    p_property_id: d.propertyId ?? null,
    p_amount_cents: d.amountEuros == null ? null : Math.round(d.amountEuros * 100),
    p_note: d.note ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

// --- Résultat commercial (décision sensible : admin/manager en base) ----------
const outcomeSchema = z.object({
  buyerProfileId: uuid,
  outcome: z.enum(["gagne", "perdu"]),
  reason: optionalText(2000),
});

export async function recordBuyerOutcomeAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return {
      ok: false,
      error: "Seul un administrateur ou un manager enregistre le résultat d’un dossier.",
    };
  }
  const parsed = outcomeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  if (d.outcome === "perdu" && !d.reason?.trim()) {
    return { ok: false, error: "Un motif de perte est obligatoire." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_record_outcome", {
    p_buyer_profile_id: d.buyerProfileId,
    p_outcome: d.outcome,
    p_reason: d.reason ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

export async function reopenBuyerAction(input: unknown): Promise<ActionResult> {
  const session = await requireCrmSession();
  if (!canDecideMandate(session.roles)) {
    return { ok: false, error: "Seul un administrateur ou un manager rouvre un dossier." };
  }
  const parsed = z
    .object({ buyerProfileId: uuid, reason: z.string().trim().min(1).max(2000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Un motif est requis pour rouvrir un dossier." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_reopen", {
    p_buyer_profile_id: parsed.data.buyerProfileId,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

// --- Suivi opérationnel : activités, notes, tâches ----------------------------
const activitySchema = z.object({
  buyerProfileId: uuid,
  type: z.enum(["appel", "tentative_appel", "email", "sms_whatsapp", "rendez_vous", "note", "autre"]),
  outcome: z
    .enum(["sans_reponse", "message_laisse", "rappel_demande", "contact_etabli", "mauvais_numero"])
    .nullable()
    .optional(),
  body: optionalText(4000),
});

export async function logBuyerActivityAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_log_activity", {
    p_buyer_profile_id: d.buyerProfileId,
    p_type: d.type,
    p_outcome: d.outcome ?? null,
    p_body: d.body ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

// --- Planifier une visite -----------------------------------------------------
const visiteSchema = z.object({
  buyerProfileId: uuid,
  /** Projet visité. Une visite appartient à UN projet : sans cela, elle
      déplaçait aussi les autres intérêts de la personne. */
  interestId: uuid,
  /** Date et heure de la visite, au format ISO. */
  at: z.string().datetime("Date de visite invalide."),
  note: optionalText(300),
});

/**
 * Caler une visite, en un seul geste.
 *
 * C'est le moment le plus important du suivi, et il se jouait jusqu'ici en
 * deux temps : créer une tâche, puis déplacer la carte. Deux gestes pour un
 * seul fait, donc deux occasions d'en oublier un — et un tableau de bord qui
 * annonçait « 0 visite planifiée » alors que la visite était bien prise.
 *
 * L'ordre compte : la tâche d'abord, l'étape ensuite. Si la tâche échoue, rien
 * n'a bougé ; si c'est l'étape qui échoue, la visite reste inscrite dans
 * l'agenda du commercial plutôt que perdue.
 */
export async function planifierVisiteAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = visiteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();

  const titre = d.note?.trim() ? `Visite — ${d.note.trim()}` : "Visite du bien";
  // `visite`, pas `rappel` : le fait est nomme la ou il se produit. L'agenda
  // des visites le lit directement, sans dependre de l'etape du pipeline (qui
  // avance des que la visite est passee) ni de l'intitule saisi.
  // Les SIX paramètres sont toujours transmis, même nuls : une surcharge de
  // cette fonction subsiste en base (l'outil d'administration ne sait pas
  // supprimer une fonction), et un appel partiel pourrait correspondre aux
  // deux signatures.
  const { error: erreurTache } = await supabase.rpc("crm_buyer_create_task", {
    p_buyer_profile_id: d.buyerProfileId,
    p_title: titre,
    p_kind: "visite",
    p_due_at: d.at,
    p_assignee_user_id: null,
    p_interest_id: d.interestId,
  });
  if (erreurTache) {
    return { ok: false, error: humanize(erreurTache.code, erreurTache.message) };
  }

  // Seule la manifestation visitée change d'étape. Les autres projets de la
  // même personne ne bougent pas.
  const { error: erreurStade } = await supabase.rpc("crm_buyer_set_interest_stage", {
    p_interest_id: d.interestId,
    p_stage: "visite",
  });
  if (erreurStade) {
    return {
      ok: false,
      error:
        "La visite est bien enregistrée dans l'agenda, mais le dossier n'a pas pu passer à l'étape « Visite ». Déplacez-le à la main.",
    };
  }

  // Conversion Meta « rendez-vous programmé » : le fait métier, c'est ici.
  enArrierePlan(() => conversionRendezVous(supabase, d.interestId));
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

const taskSchema = z.object({
  buyerProfileId: uuid,
  title: z.string().trim().min(1, "Un intitulé est requis.").max(300),
  kind: z.enum(["rappel", "tache"]).default("rappel"),
  dueAt: z.string().datetime().nullable().optional(),
  assigneeUserId: uuid.nullable().optional(),
});

export async function createBuyerTaskAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  // Les six paramètres sont toujours transmis (voir `planifierVisiteAction`).
  // `p_interest_id` nul : un rappel saisi ici est un suivi général, qui vaut
  // pour tous les projets de la personne.
  const { error } = await supabase.rpc("crm_buyer_create_task", {
    p_buyer_profile_id: d.buyerProfileId,
    p_title: d.title,
    p_kind: d.kind,
    p_due_at: d.dueAt ?? null,
    p_assignee_user_id: d.assigneeUserId ?? null,
    p_interest_id: null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

/**
 * Corriger une tâche ENCORE À FAIRE : intitulé, échéance, responsable.
 *
 * Le CRM savait créer une tâche et la terminer, jamais la corriger. On
 * contournait en créant une tâche de remplacement depuis un second formulaire
 * de planification — celui-là même qui faisait saisir deux fois la même
 * décision, et qui disparaît. Retirer le contournement sans offrir la
 * correction aurait enlevé une capacité au lieu d'en simplifier une.
 *
 * `effacerEcheance` est explicite parce que `null` est ambigu : sans lui,
 * « enlever la date » et « ne pas toucher à la date » s'écriraient pareil.
 */
export async function updateBuyerTaskAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z
    .object({
      buyerProfileId: uuid,
      taskId: uuid,
      title: z.string().trim().min(1).max(300).nullable().optional(),
      dueAt: z.string().datetime().nullable().optional(),
      assigneeUserId: uuid.nullable().optional(),
      effacerEcheance: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const d = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_update_task", {
    p_task_id: d.taskId,
    p_title: d.title ?? null,
    p_due_at: d.dueAt ?? null,
    p_assignee_user_id: d.assigneeUserId ?? null,
    p_effacer_echeance: d.effacerEcheance ?? false,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

export async function setBuyerTaskStatusAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = z
    .object({
      buyerProfileId: uuid,
      taskId: uuid,
      status: z.enum(["a_faire", "fait", "annule"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_set_task_status", {
    p_task_id: parsed.data.taskId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };
  revalidateBuyer(parsed.data.buyerProfileId);
  return { ok: true };
}

// --- Traitement d'un appel : une seule écriture -------------------------------
/**
 * Ce que le commercial renseigne en raccrochant, en un seul geste : le résultat
 * de l'appel, sa qualification, une note, la prochaine action.
 *
 * Tout est facultatif, et c'est délibéré : on n'oblige pas à qualifier un
 * injoignable, ni à écrire une note à chaque tentative. Exiger les deux à
 * chaque appel produit des qualifications au hasard et des notes vides.
 *
 * Les quatre données restent SÉPARÉES jusqu'en base — résultat, qualification,
 * étape, prochaine action. « Gros potentiel + injoignable + rappel demain + en
 * discussion » est un état parfaitement cohérent, et le système doit savoir
 * l'écrire.
 */
/**
 * Un enregistrement de traitement : l'activité, la qualification, l'étape et
 * la prochaine tâche, en UNE fois.
 *
 * Les quatre partaient auparavant par des chemins différents — c'est ce qui
 * obligeait Antoine à sauvegarder, attendre, puis recommencer ailleurs. Un
 * seul appel, une seule transaction : soit tout est écrit, soit rien ne l'est
 * et la saisie reste à l'écran.
 */
const enregistrementSchema = z.object({
  buyerProfileId: uuid,
  /**
   * Le bien concerné, FACULTATIF.
   *
   * Nul = « Général / Tous les biens ». C'est le cas le plus fréquent : on
   * parle à quelqu'un, et seulement parfois d'un bien en particulier. Exiger
   * un bien obligeait à saisir DEUX activités pour un seul appel qui parlait
   * de deux villas — ou, plus souvent, à n'en saisir qu'une et à perdre la
   * moitié de ce qui s'était dit.
   *
   * Les visites et les offres, elles, en exigent un : la base refuse une
   * visite sans bien plutôt que d'enregistrer un rendez-vous sans adresse.
   */
  interestId: uuid.nullable().optional(),
  activite: z
    .enum([
      "appel_sans_reponse",
      "appel_echange",
      "message_vocal",
      "whatsapp",
      "sms",
      "email",
      "note",
    ])
    .nullable()
    .optional(),
  /** Quand l'échange a RÉELLEMENT eu lieu. La date de saisie est à part. */
  occurredAt: z.string().datetime({ offset: true }).nullable().optional(),
  note: optionalText(4000),
  qualification: z
    .enum(["a_qualifier", "gros_potentiel", "qualifie", "non_qualifie"])
    .nullable()
    .optional(),
  qualificationReason: optionalText(300),
  stage: z
    .enum([
      "a_contacter",
      "a_rappeler",
      "en_discussion",
      "visite_planifiee",
      "vivier",
      "pas_interesse",
      "mauvais_numero",
    ])
    .nullable()
    .optional(),
  nextActionKind: z.enum(["rappel", "tache", "visite"]).nullable().optional(),
  nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
  nextActionTitle: optionalText(200),
  nextActionAssignee: uuid.nullable().optional(),
  completeTaskId: uuid.nullable().optional(),
});

export async function enregistrerTraitementAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = enregistrementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Saisie invalide. Vérifiez les champs." };
  const d = parsed.data;

  /* Dit ici plutôt que renvoyé par la base : « un motif est requis » est une
     phrase qu'on comprend, « violation de contrainte » non. */
  if (d.qualification === "non_qualifie" && !d.qualificationReason?.trim()) {
    return { ok: false, error: "Indiquez un motif pour écarter ce dossier." };
  }

  /* Dit ici aussi, pour la même raison : « une visite se rattache à un bien
     précis » se comprend, et on corrige sans perdre le reste de la saisie. */
  if (d.nextActionKind === "visite" && !d.interestId) {
    return { ok: false, error: "Choisissez le bien concerné pour planifier une visite." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: ecrit, error } = await supabase.rpc("crm_buyer_enregistrer", {
    p_buyer_profile_id: d.buyerProfileId,
    p_interest_id: d.interestId ?? null,
    p_activite: d.activite ?? null,
    p_occurred_at: d.occurredAt ?? null,
    p_note: d.note ?? null,
    p_qualification: d.qualification ?? null,
    p_qualification_reason: d.qualificationReason ?? null,
    p_stage: d.stage ?? null,
    p_next_action_kind: d.nextActionKind ?? null,
    p_next_action_at: d.nextActionAt ?? null,
    p_next_action_title: d.nextActionTitle ?? null,
    p_next_action_assignee: d.nextActionAssignee ?? null,
    p_complete_task_id: d.completeTaskId ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  /*
   * ON RELIT CE QUI A ÉTÉ ÉCRIT, et pas ce qu'on a demandé.
   *
   * Un champ proposé à l'écran et silencieusement perdu en base est la pire
   * des pannes : elle ne se voit pas. Un commercial affecte un rappel à son
   * collègue, l'écran dit « enregistré », et personne ne rappelle. La base
   * renvoie donc le responsable RÉELLEMENT posé ; s'il ne correspond pas à
   * celui qu'on a choisi, on le dit au lieu de laisser croire.
   *
   * C'est ce qui protège aussi la fenêtre entre une migration et le
   * déploiement : si la fonction en ligne ignorait ce paramètre, l'écart se
   * verrait ici au lieu de passer inaperçu.
   */
  const retour = ecrit as {
    task_id?: string | null;
    next_action_assignee?: string | null;
  } | null;
  if (d.nextActionAssignee && retour?.task_id) {
    if (retour.next_action_assignee !== d.nextActionAssignee) {
      revalidateBuyer(d.buyerProfileId);
      return {
        ok: false,
        error:
          "Le reste est enregistré, mais le responsable du rappel n'a pas pu l'être. " +
          "Vérifiez-le sur la fiche avant de passer au suivant.",
      };
    }
  }

  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}

const traitementSchema = z.object({
  buyerProfileId: uuid,
  interestId: uuid,
  callOutcome: z
    .enum(["contact_etabli", "sans_reponse", "message_laisse", "mauvais_numero"])
    .nullable()
    .optional(),
  qualification: z
    .enum(["a_qualifier", "gros_potentiel", "qualifie", "en_reflexion", "non_qualifie"])
    .nullable()
    .optional(),
  qualificationReason: optionalText(300),
  note: optionalText(4000),
  // Les étapes engageantes restent absentes : elles ont leur action dédiée.
  stage: z.enum(["nouveau", "a_rappeler", "en_discussion", "visite", "vivier"]).nullable().optional(),
  nextActionKind: z.enum(["rappel", "tache", "visite"]).nullable().optional(),
  nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
  nextActionTitle: optionalText(200),
  /** Rappel que ce traitement solde. */
  completeTaskId: uuid.nullable().optional(),
});

export async function recordBuyerTreatmentAction(input: unknown): Promise<ActionResult> {
  await requireCrmSession();
  const parsed = traitementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Saisie invalide. Vérifiez les champs." };
  }
  const d = parsed.data;

  // Un motif est exigé pour écarter : la base le refuserait, autant le dire
  // ici, tout de suite, plutôt que de renvoyer une erreur technique.
  if (d.qualification === "non_qualifie" && !d.qualificationReason?.trim()) {
    return { ok: false, error: "Indiquez un motif pour écarter ce dossier." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("crm_buyer_record_treatment", {
    p_interest_id: d.interestId,
    p_call_outcome: d.callOutcome ?? null,
    p_qualification: d.qualification ?? null,
    p_qualification_reason: d.qualificationReason ?? null,
    p_note: d.note ?? null,
    p_stage: d.stage ?? null,
    p_next_action_kind: d.nextActionKind ?? null,
    p_next_action_at: d.nextActionAt ?? null,
    p_next_action_title: d.nextActionTitle ?? null,
    p_complete_task_id: d.completeTaskId ?? null,
  });
  if (error) return { ok: false, error: humanize(error.code, error.message) };

  // Les conversions suivent le FAIT métier, pas le clic : seule une entrée
  // réelle en discussion ou en visite les déclenche.
  if (d.stage === "en_discussion") {
    enArrierePlan(() => conversionInscriptionTerminee(supabase, d.interestId));
  }
  if (d.stage === "visite") {
    enArrierePlan(() => conversionRendezVous(supabase, d.interestId));
  }

  revalidateBuyer(d.buyerProfileId);
  return { ok: true };
}
