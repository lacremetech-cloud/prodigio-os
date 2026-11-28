import type { SupabaseClient } from "@supabase/supabase-js";
import { isProductionDeployment, modeNouveauxSignaux, modePaliers, type ModeSignaux } from "@/config";
import { budgetChoiceBounds, BUYER_BUDGET_CHOICES, type BuyerBudgetChoice } from "@/modules/buyers/funnel/universal";
import {
  buildEventPayload,
  envoyerConversionMeta,
  peutEtreRattache,
  type MetaConversion,
  type MetaEventName,
  type MetaIdentity,
  type MetaSendOutcome,
} from "./capi";
import { contexteDeLaManifestation, dejaEnvoyee, donneesDuBien, tracer } from "./conversions";

/**
 * LES NOUVEAUX SIGNAUX DE L'ÉTAPE 4 — EN ESSAI PAR DÉFAUT.
 *
 * Décidés par Victor le 28/11/2026 (docs/27, docs/05 n° 46) :
 *
 *   • qualifié              → `LeadQualifie`       (décision de l'équipe)
 *   • R1 planifié           → `Contact`
 *   • offre                 → `SubmitApplication`
 *   • paliers de budget     → `LeadBudgetAuMoins500k`, `…1M`, `…2M`, `…3M`
 *                             (cumulatifs, d'après la réponse au formulaire)
 *
 * EN ESSAI, RIEN NE PART : le journal note ce qui serait parti (« simulee »),
 * ou pourquoi cela ne partirait pas. Deux interrupteurs, posés par Victor dans
 * Vercel : `META_CAPI_SIGNAUX` et `META_CAPI_PALIERS` ; seule la valeur exacte
 * `envoi` envoie vraiment. Pour les paliers, pas avant l'accord ÉCRIT de Meta,
 * la mention du formulaire corrigée et validée par un juriste, et son feu vert
 * explicite.
 *
 * Aucun montant ne part jamais : un palier porte son nom (qui dit ce qu'il
 * est), et le bien, comme les autres conversions. « Qualifié » ne porte ni
 * montant ni réponse de budget : c'est une décision de l'équipe sur tout le
 * dossier.
 */

export const PALIERS = [
  { min: 50_000_000, nom: "LeadBudgetAuMoins500k" },
  { min: 100_000_000, nom: "LeadBudgetAuMoins1M" },
  { min: 200_000_000, nom: "LeadBudgetAuMoins2M" },
  { min: 300_000_000, nom: "LeadBudgetAuMoins3M" },
] as const satisfies readonly { min: number; nom: MetaEventName }[];

export type NomPalier = (typeof PALIERS)[number]["nom"];

/**
 * Les paliers qu'une réponse atteint, du plus bas au plus haut : ceux dont le
 * seuil ne dépasse pas le BAS de la réponse. « Pas de projet », une réponse
 * absente ou inconnue n'en atteignent aucun.
 */
export function paliersAtteints(reponse: string | null | undefined): NomPalier[] {
  if (!reponse || reponse === "aucun_projet") return [];
  if (!(BUYER_BUDGET_CHOICES as readonly string[]).includes(reponse)) return [];
  const bas = budgetChoiceBounds(reponse as BuyerBudgetChoice).min;
  if (bas == null) return [];
  return PALIERS.filter((p) => bas >= p.min).map((p) => p.nom);
}

/**
 * Envoyer, ou essayer sans rien envoyer. En essai, on fait tout sauf l'appel
 * à Meta : production seulement, le même contrôle de correspondance que
 * l'envoi réel, et une ligne au journal — « simulee », ou le motif.
 */
export async function envoyerOuEssayer(e: {
  supabase: SupabaseClient | null;
  mode: ModeSignaux;
  conversion: MetaConversion;
  interestId: string | null;
  /** Demander d'abord au journal si la même conversion est déjà partie (ou déjà essayée). */
  verifierDeja: boolean;
}): Promise<MetaSendOutcome> {
  const { conversion } = e;
  if (e.verifierDeja && e.supabase && (await dejaTracee(e.supabase, conversion.eventId, e.mode))) {
    const deja: MetaSendOutcome = { sent: false, reason: "deja_envoyee" };
    /* En essai, rien n'est jamais parti : écrire « deja_envoyee » se lirait
       comme un envoi. Un signal déjà essayé n'écrit donc rien — sa ligne
       « simulee » dit déjà ce qui serait parti. À l'envoi réel, le motif dit
       vrai, et il s'écrit. */
    if (e.mode === "essai") return deja;
    return tracer(e.supabase, conversion.eventName, conversion.eventId, e.interestId, deja);
  }
  let resultat: MetaSendOutcome;
  if (e.mode === "envoi") {
    resultat = await envoyerConversionMeta(conversion);
  } else if (!isProductionDeployment()) {
    resultat = { sent: false, reason: "hors_production" };
  } else {
    const userData = buildEventPayload(conversion).user_data as Record<string, unknown>;
    resultat = peutEtreRattache(conversion.eventName, userData)
      ? { sent: false, reason: "simulee" }
      : { sent: false, reason: "sans_correspondance" };
  }
  return tracer(e.supabase, conversion.eventName, conversion.eventId, e.interestId, resultat);
}

/**
 * Déjà partie, ou — en essai — déjà essayée ? Un essai ne compte pas comme un
 * envoi : quand l'interrupteur passera à `envoi`, la conversion partira bien.
 */
async function dejaTracee(supabase: SupabaseClient, eventId: string, mode: ModeSignaux): Promise<boolean> {
  if (mode === "envoi") return dejaEnvoyee(supabase, eventId);
  try {
    const { data, error } = await supabase.rpc("crm_meta_conversion_deja_simulee", { p_event_id: eventId });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Un signal du CRM, sur une manifestation : le même contexte que les autres conversions. */
async function signalDuCrm(
  supabase: SupabaseClient,
  eventName: Extract<MetaEventName, "LeadQualifie" | "Contact" | "SubmitApplication">,
  eventId: string,
  interestId: string,
): Promise<MetaSendOutcome> {
  const contexte = await contexteDeLaManifestation(supabase, interestId);
  if (!contexte) return tracer(supabase, eventName, eventId, interestId, { sent: false, reason: "sans_correspondance" });
  return envoyerOuEssayer({
    supabase,
    mode: modeNouveauxSignaux(),
    interestId,
    verifierDeja: true,
    conversion: {
      eventName,
      eventId,
      eventSourceUrl: contexte.sourceUrl,
      identity: contexte.identity,
      customData: contexte.customData,
    },
  });
}

/** `LeadQualifie` — l'équipe qualifie la personne (« qualifié » ou « gros potentiel »). Une fois par manifestation. */
export function signalLeadQualifie(supabase: SupabaseClient, interestId: string): Promise<MetaSendOutcome> {
  return signalDuCrm(supabase, "LeadQualifie", `leadqualifie-${interestId}`, interestId);
}

/** `Contact` — le dossier entre en « R1 planifié ». Une fois par manifestation. */
export function signalContact(supabase: SupabaseClient, interestId: string): Promise<MetaSendOutcome> {
  return signalDuCrm(supabase, "Contact", `contact-${interestId}`, interestId);
}

/** `SubmitApplication` — une offre est enregistrée. Une fois par manifestation. */
export function signalOffre(supabase: SupabaseClient, interestId: string): Promise<MetaSendOutcome> {
  return signalDuCrm(supabase, "SubmitApplication", `offre-${interestId}`, interestId);
}

/**
 * Les paliers d'une demande, au dépôt du formulaire : un événement par palier
 * atteint par la réponse DÉCLARÉE, avec la même identité que son `Lead`. Le
 * dépôt est sans session : la trace passe par la porte étroite du journal
 * (une demande toute récente, chaque palier une seule fois).
 */
export async function signauxDeBudget(e: {
  supabase: SupabaseClient | null;
  interestId: string;
  reponse: string | null | undefined;
  identity: MetaIdentity;
  sourceUrl: string | null;
  propertyName: string | null;
  propertyId: string | null;
}): Promise<MetaSendOutcome[]> {
  const resultats: MetaSendOutcome[] = [];
  for (const nom of paliersAtteints(e.reponse)) {
    resultats.push(
      await envoyerOuEssayer({
        supabase: e.supabase,
        mode: modePaliers(),
        interestId: e.interestId,
        verifierDeja: false,
        conversion: {
          eventName: nom,
          eventId: `${nom}-${e.interestId}`,
          eventSourceUrl: e.sourceUrl,
          identity: e.identity,
          customData: donneesDuBien(e.propertyName, e.propertyId),
        },
      }),
    );
  }
  return resultats;
}
