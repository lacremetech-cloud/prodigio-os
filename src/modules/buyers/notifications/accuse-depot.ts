import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Accusé de réception d'un dépôt — appel d'une automatisation externe.
 *
 * Ce que ça résout : le délai de rappel. Une demande déposée à 2 h du matin
 * attend le premier commercial disponible, et c'est exactement là qu'un dossier
 * se perd. L'automatisation, elle, envoie un SMS dans la seconde avec le lien
 * du dossier — la personne sait qu'elle a été entendue, et le rappel humain
 * arrive ensuite sans urgence.
 *
 * Trois règles tenues ici :
 *
 *  • **Jamais bloquant.** Cet appel part APRÈS la réponse au visiteur, comme
 *    l'alerte Slack. Une automatisation injoignable ne doit jamais empêcher
 *    un dépôt ni le ralentir.
 *  • **Jamais journalisé.** Ni l'adresse appelée, ni le téléphone, ni l'e-mail
 *    n'apparaissent dans les journaux — seulement un code de statut.
 *  • **Une adresse par bien**, lue en base. Un nouveau bien se configure sans
 *    toucher au code ni redéployer.
 */

export type AccuseFetch = typeof fetch;

/** Ce qui part à l'automatisation. Rien de plus que ce qu'elle doit écrire. */
export interface ChargeAccuse {
  interest_id: string;
  property_slug: string | null;
  property_name: string | null;
  /** Adresse du dossier, pour que le SMS porte le bon lien sans le recopier. */
  brochure_url: string | null;
  first_name: string | null;
  last_name: string | null;
  /** Format international (+33…), seul format qu'un envoi de SMS accepte. */
  phone: string | null;
  email: string | null;
  budget_choice: string | null;
  submitted_at: string;
}

export interface ConfigDepot {
  webhookUrl: string | null;
  brochureUrl: string | null;
  slug: string | null;
  publicName: string | null;
}

/**
 * Lit, pour une manifestation, l'adresse à appeler et le lien du dossier.
 *
 * Le client passé doit pouvoir LIRE `property_public_config`, dont la RLS est
 * réservée au rôle `authenticated` : un dépôt est anonyme, donc l'appelant
 * fournit ici le client serveur. Sans cela cette lecture rend vide en silence,
 * et l'accusé ne part jamais — c'est la panne qui a déjà coûté le nom du bien
 * dans les alertes Slack.
 */
export async function configDuDepot(
  supabase: SupabaseClient,
  interestId: string,
): Promise<ConfigDepot | null> {
  const { data: interet } = await supabase
    .from("buyer_interests")
    .select("property_id")
    .eq("id", interestId)
    .maybeSingle();
  const propertyId = (interet as { property_id: string | null } | null)?.property_id ?? null;
  if (!propertyId) return null;

  const { data: config } = await supabase
    .from("property_public_config")
    .select("slug, public_name, buyer_form_brochure_url, buyer_form_webhook_url")
    .eq("property_id", propertyId)
    .maybeSingle();
  const ligne = config as {
    slug: string | null;
    public_name: string | null;
    buyer_form_brochure_url: string | null;
    buyer_form_webhook_url: string | null;
  } | null;
  if (!ligne) return null;

  return {
    webhookUrl: ligne.buyer_form_webhook_url,
    brochureUrl: ligne.buyer_form_brochure_url,
    slug: ligne.slug,
    publicName: ligne.public_name,
  };
}

function net(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}

export function construireCharge(input: {
  interestId: string;
  config: ConfigDepot;
  propertyName: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  budgetChoice?: string | null;
  submittedAt?: Date;
}): ChargeAccuse {
  return {
    interest_id: input.interestId,
    property_slug: input.config.slug,
    /* Le nom public d'abord — c'est celui que la personne a vu sur la page.
       À défaut, le nom interne, qui vaut toujours mieux qu'un SMS muet. */
    property_name: net(input.config.publicName) ?? net(input.propertyName),
    brochure_url: net(input.config.brochureUrl),
    first_name: net(input.firstName),
    last_name: net(input.lastName),
    phone: net(input.phone),
    email: net(input.email),
    budget_choice: net(input.budgetChoice),
    submitted_at: (input.submittedAt ?? new Date()).toISOString(),
  };
}

export interface ResultatAccuse {
  envoye: boolean;
  raison?: "sans_adresse" | "sans_telephone" | "refus" | "injoignable";
  status?: number;
}

/**
 * Appelle l'automatisation. Ne lève jamais : renvoie la raison d'un non-envoi.
 *
 * Un dépôt sans téléphone ne déclenche rien — l'automatisation n'aurait rien à
 * composer, et un appel à vide ferait croire à un SMS parti.
 */
export async function envoyerAccuseDepot(
  charge: ChargeAccuse,
  webhookUrl: string | null,
  opts: { fetchImpl?: AccuseFetch; timeoutMs?: number } = {},
): Promise<ResultatAccuse> {
  if (!net(webhookUrl)) return { envoye: false, raison: "sans_adresse" };
  if (!charge.phone) return { envoye: false, raison: "sans_telephone" };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), opts.timeoutMs ?? 4000);
  try {
    const reponse = await fetchImpl(webhookUrl as string, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(charge),
      signal: controleur.signal,
      cache: "no-store",
    });
    if (!reponse.ok) return { envoye: false, raison: "refus", status: reponse.status };
    return { envoye: true, status: reponse.status };
  } catch {
    return { envoye: false, raison: "injoignable" };
  } finally {
    clearTimeout(minuteur);
  }
}
