import type { SupabaseClient } from "@supabase/supabase-js";
import { envoyerConversionMeta, type MetaIdentity, type MetaSendOutcome } from "./capi";

/**
 * Les trois conversions suivies par Prodigio, dans le vocabulaire Meta :
 *
 *   • prospect                → `Lead`
 *   • inscription terminée    → `CompleteRegistration`  (entrée en discussion)
 *   • rendez-vous programmé   → `Schedule`              (visite)
 *
 * Chacune est émise **à l'instant du fait métier**, pas à l'affichage d'une
 * page : une demande déposée, une qualification validée par une personne, une
 * visite planifiée. C'est ce qui donne à Meta une conversion comparable d'une
 * campagne à l'autre.
 *
 * Les coordonnées du prospect ne sont jamais envoyées en clair : `capi.ts` les
 * normalise puis les hache. Le but n'est pas d'identifier quelqu'un chez Meta,
 * mais de rattacher une conversion à la publicité qui l'a produite.
 */

/** Un seul jour de granularité : rejouer le même fait le même jour ne compte qu'une fois. */
function jour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Coordonnées, attribution et bien d'UNE manifestation précise.
 *
 * C'est elle qui porte le `fbclid` de la publicité d'origine : sans lui, une
 * conversion survenue des semaines plus tard ne serait rattachée à aucune
 * campagne.
 *
 * Elle était auparavant relue sur la manifestation la plus RÉCENTE de la
 * personne. Pour un acquéreur intéressé par deux biens — un par campagne — une
 * visite sur Villa Jean Jaurès partait donc avec le clic d'une publicité Villa
 * Verdun : les deux campagnes se volaient leurs conversions. On lit désormais
 * la manifestation concernée, et elle seule.
 */
interface LigneInteret {
  contact_email: string | null;
  contact_phone: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  fbclid: string | null;
  origin_url: string | null;
  created_at: string | null;
  property_id: string | null;
}

interface ContexteInteret {
  identity: MetaIdentity;
  sourceUrl: string | null;
  customData: Record<string, unknown> | undefined;
}

async function contexteDeLaManifestation(
  supabase: SupabaseClient,
  interestId: string,
): Promise<ContexteInteret | null> {
  const { data } = await supabase
    .from("buyer_interests")
    .select(
      "contact_email, contact_phone, contact_first_name, contact_last_name, fbclid, origin_url, created_at, property_id",
    )
    .eq("id", interestId)
    .maybeSingle();
  const ligne = data as LigneInteret | null;
  if (!ligne) return null;

  const bien = await bienDeLaManifestation(supabase, interestId);

  return {
    identity: {
      email: ligne.contact_email,
      phone: ligne.contact_phone,
      firstName: ligne.contact_first_name,
      lastName: ligne.contact_last_name,
      fbclid: ligne.fbclid,
      clickedAt: ligne.created_at,
      // Ni IP ni user-agent ici : la conversion est déclenchée depuis le CRM,
      // le navigateur présent est celui du commercial. L'envoyer dégraderait
      // la correspondance au lieu de l'améliorer.
    },
    sourceUrl: ligne.origin_url,
    customData: donneesDuBien(bien?.nom ?? null, bien?.id ?? null),
  };
}

/**
 * Le bien d'une manifestation. Lu en base plutôt que transmis par l'appelant :
 * c'est la même règle de libellé partout (titre commercial, sinon nom de
 * projet), et le dépôt du formulaire n'a pas à la connaître.
 */
export async function bienDeLaManifestation(
  supabase: SupabaseClient,
  interestId: string,
): Promise<{ id: string; nom: string | null } | null> {
  const { data } = await supabase
    .from("buyer_interests")
    .select("property_id, properties(commercial_title, project_name)")
    .eq("id", interestId)
    .maybeSingle();
  const ligne = data as {
    property_id: string | null;
    properties: { commercial_title: string | null; project_name: string | null } | null;
  } | null;
  if (!ligne?.property_id) return null;
  return {
    id: ligne.property_id,
    nom: ligne.properties?.commercial_title || ligne.properties?.project_name || null,
  };
}

/**
 * Le bien concerné, dans le vocabulaire de Meta.
 *
 * Il permet de ventiler les conversions PAR BIEN dans le Gestionnaire de
 * publicités, sans dépendre du nom donné aux campagnes. L'identifiant du bien
 * accompagne le libellé : un nom commercial peut changer, pas lui.
 */
export function donneesDuBien(
  nom: string | null,
  propertyId: string | null,
): Record<string, unknown> | undefined {
  const data: Record<string, unknown> = {};
  if (nom) data.content_name = nom;
  if (propertyId) data.content_ids = [propertyId];
  if (nom || propertyId) data.content_category = "bien_immobilier";
  return Object.keys(data).length > 0 ? data : undefined;
}

/** `Lead` — une demande vient d'être déposée depuis un tunnel. */
export function conversionProspect(input: {
  interestId: string;
  identity: MetaIdentity;
  sourceUrl?: string | null;
  propertyName?: string | null;
  propertyId?: string | null;
}): Promise<MetaSendOutcome> {
  return envoyerConversionMeta({
    eventName: "Lead",
    eventId: `lead-${input.interestId}`,
    eventSourceUrl: input.sourceUrl ?? null,
    identity: input.identity,
    customData: donneesDuBien(input.propertyName ?? null, input.propertyId ?? null),
  });
}

/**
 * `CompleteRegistration` — le dossier entre en discussion : quelqu'un a répondu
 * et la conversation est réelle. C'est une décision humaine, jamais un score.
 */
export async function conversionInscriptionTerminee(
  supabase: SupabaseClient,
  interestId: string,
): Promise<MetaSendOutcome> {
  const contexte = await contexteDeLaManifestation(supabase, interestId);
  if (!contexte) return { sent: false, reason: "sans_correspondance" };
  return envoyerConversionMeta({
    eventName: "CompleteRegistration",
    // Une manifestation n'entre en discussion qu'une fois. L'identifiant porte
    // la MANIFESTATION et non la personne : quelqu'un qui entre en discussion
    // sur deux biens produit deux conversions, une par campagne, ce qui est
    // bien ce qui s'est passé.
    eventId: `qualifie-${interestId}`,
    eventSourceUrl: contexte.sourceUrl,
    identity: contexte.identity,
    customData: contexte.customData,
  });
}

/** `Schedule` — une visite est programmée pour ce dossier. */
export async function conversionRendezVous(
  supabase: SupabaseClient,
  interestId: string,
  at: Date = new Date(),
): Promise<MetaSendOutcome> {
  const contexte = await contexteDeLaManifestation(supabase, interestId);
  if (!contexte) return { sent: false, reason: "sans_correspondance" };
  return envoyerConversionMeta({
    eventName: "Schedule",
    // Une manifestation peut revenir en visite plus tard — c'est alors une
    // vraie seconde conversion. Mais glisser la carte deux fois le même jour
    // n'en est pas une : la date entre dans l'identifiant, l'heure non.
    eventId: `visite-${interestId}-${jour(at)}`,
    eventTime: at,
    eventSourceUrl: contexte.sourceUrl,
    identity: contexte.identity,
    customData: contexte.customData,
  });
}
