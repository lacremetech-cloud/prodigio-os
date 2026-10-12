import type { SupabaseClient } from "@supabase/supabase-js";
import { envoyerConversionMeta, type MetaIdentity, type MetaSendOutcome } from "./capi";

/**
 * Les trois conversions suivies par Prodigio, dans le vocabulaire Meta :
 *
 *   • prospect                → `Lead`
 *   • inscription terminée    → `CompleteRegistration`  (dossier qualifié)
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
 * Coordonnées et attribution du dossier, relues depuis la demande la plus
 * récente. C'est elle qui porte le `fbclid` de la publicité d'origine : sans
 * lui, une conversion survenue des semaines plus tard ne serait rattachée à
 * aucune campagne.
 */
interface LigneInteret {
  contact_email: string | null;
  contact_phone: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  fbclid: string | null;
  origin_url: string | null;
  created_at: string | null;
}

async function identiteDuDossier(
  supabase: SupabaseClient,
  buyerProfileId: string,
): Promise<{ identity: MetaIdentity; sourceUrl: string | null } | null> {
  const { data } = await supabase
    .from("buyer_interests")
    .select(
      "contact_email, contact_phone, contact_first_name, contact_last_name, fbclid, origin_url, created_at",
    )
    .eq("buyer_profile_id", buyerProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ligne = data as LigneInteret | null;
  if (!ligne) return null;
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
  };
}

/** `Lead` — une demande vient d'être déposée depuis un tunnel. */
export function conversionProspect(input: {
  interestId: string;
  identity: MetaIdentity;
  sourceUrl?: string | null;
  propertyName?: string | null;
}): Promise<MetaSendOutcome> {
  return envoyerConversionMeta({
    eventName: "Lead",
    eventId: `lead-${input.interestId}`,
    eventSourceUrl: input.sourceUrl ?? null,
    identity: input.identity,
    customData: input.propertyName ? { content_name: input.propertyName } : undefined,
  });
}

/** `CompleteRegistration` — une personne a validé la qualification du dossier. */
export async function conversionInscriptionTerminee(
  supabase: SupabaseClient,
  buyerProfileId: string,
): Promise<MetaSendOutcome> {
  const dossier = await identiteDuDossier(supabase, buyerProfileId);
  if (!dossier) return { sent: false, reason: "sans_correspondance" };
  return envoyerConversionMeta({
    eventName: "CompleteRegistration",
    // Un dossier ne se qualifie qu'une fois : l'identifiant du dossier suffit,
    // et une requalification ne recompte pas la conversion.
    eventId: `qualifie-${buyerProfileId}`,
    eventSourceUrl: dossier.sourceUrl,
    identity: dossier.identity,
  });
}

/** `Schedule` — une visite est programmée pour ce dossier. */
export async function conversionRendezVous(
  supabase: SupabaseClient,
  buyerProfileId: string,
  at: Date = new Date(),
): Promise<MetaSendOutcome> {
  const dossier = await identiteDuDossier(supabase, buyerProfileId);
  if (!dossier) return { sent: false, reason: "sans_correspondance" };
  return envoyerConversionMeta({
    eventName: "Schedule",
    // Un dossier peut revenir en visite plus tard — c'est alors une vraie
    // seconde conversion. Mais glisser la carte deux fois le même jour n'en
    // est pas une : la date entre dans l'identifiant, l'heure non.
    eventId: `visite-${buyerProfileId}-${jour(at)}`,
    eventTime: at,
    eventSourceUrl: dossier.sourceUrl,
    identity: dossier.identity,
  });
}
