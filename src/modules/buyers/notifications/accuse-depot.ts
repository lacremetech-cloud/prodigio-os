import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUDGET_CHOICE_COURT } from "../funnel/universal";
import type { BuyerBudgetChoice } from "../funnel/universal";

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
  /**
   * Le MEME budget, en clair : « Plus d'1 M€ ».
   *
   * `budget_choice` est un code technique. Une automatisation qui s'en sert
   * pour ecrire un e-mail affiche « plus_1m » a un humain, ou doit recopier
   * une table de correspondance qui divergera le jour ou l'on ajoute une
   * tranche — c'est deja arrive une fois cette semaine. Le libelle part donc
   * avec le code, depuis la source unique qui les tient tous les deux.
   *
   * Champ ADDITIF : les consommateurs existants ne lisent que `budget_choice`
   * et ne voient pas la difference.
   */
  budget_libelle: string | null;
  submitted_at: string;
}

export interface ConfigDepot {
  webhookUrl: string | null;
  brochureUrl: string | null;
  slug: string | null;
  /** Code court du lien de brochure. À défaut, `slug` fait l'affaire. */
  brochureSlug: string | null;
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
    .select("slug, public_name, brochure_slug, buyer_form_brochure_url, buyer_form_webhook_url")
    .eq("property_id", propertyId)
    .maybeSingle();
  const ligne = config as {
    slug: string | null;
    public_name: string | null;
    brochure_slug: string | null;
    buyer_form_brochure_url: string | null;
    buyer_form_webhook_url: string | null;
  } | null;
  if (!ligne) return null;

  return {
    webhookUrl: ligne.buyer_form_webhook_url,
    brochureUrl: ligne.buyer_form_brochure_url,
    slug: ligne.slug,
    brochureSlug: ligne.brochure_slug,
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
    budget_libelle:
      BUDGET_CHOICE_COURT[net(input.budgetChoice) as BuyerBudgetChoice] ?? null,
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

/**
 * Alphabet GSM-7, celui que tout téléphone sait lire sans surcoût.
 *
 * Un SMS écrit entièrement dans cet alphabet tient en 160 caractères. Un seul
 * caractère en dehors le fait basculer en UCS-2, où la limite tombe à 70 : un
 * message de 140 caractères passe alors de 1 à 3 crédits.
 *
 * Le point important, et contre-intuitif : **la plupart des accents français
 * sont dedans**. `é è à ù ì ò ä ö ü ñ` ne coûtent rien. Ce sont les
 * circonflexes et les trémas qui sortent — `ê â î ô û ë ï` — ainsi que le `ç`
 * minuscule et les majuscules accentuées comme `À`.
 *
 * Écrire tout le message sans accents serait donc payer un prix qu'on ne doit
 * pas : « brochure détaillée » et « très vite » sont gratuits.
 */
const ALPHABET_GSM7 = new Set(
  "@£$¥èéùìòÇ\n\fØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
    "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

/** Vrai si tout le texte tient dans l'alphabet GSM-7. */
export function tientEnGsm7(v: string): boolean {
  for (const c of v) if (!ALPHABET_GSM7.has(c)) return false;
  return true;
}

/** Retire les signes diacritiques : « Jérôme » → « Jerome ». */
export function sansAccents(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Prépare une valeur VARIABLE pour le SMS.
 *
 * Le prénom et le nom du bien ne sont pas écrits par nous : ils viennent du
 * formulaire et de la fiche. « François », « Jérôme », « Benoît », « Gaëlle »
 * contiennent chacun un caractère hors alphabet, et un seul suffit à tripler
 * le coût du message entier.
 *
 * On n'enlève donc les accents QUE si le champ en contient un qui coûte — et
 * alors on les enlève tous, car « Jérome » (le `ô` seul retiré) serait une
 * faute, là où « Jerome » est une graphie admise. « Cécile » et « Chloé », eux,
 * gardent leur accent : il ne coûte rien.
 */
export function pourSms(v: string): string {
  return tientEnGsm7(v) ? v : sansAccents(v);
}

/**
 * Le texte de l'accusé.
 *
 * Il part dans la seconde qui suit le dépôt, souvent la nuit, et c'est le
 * premier mot que l'agence adresse à la personne. Il est donc écrit comme un
 * message de personne à personne : pas de « Nous vous rappelons sous 24h
 * ouvrées », qui est une clause ; pas de signature en capitales, qui est un
 * logo. Deux prénoms à la place — ce sont eux qui rappelleront.
 *
 * Le nom du bien n'y figure PAS, et c'est délibéré : le lien le porte déjà,
 * en toutes lettres et juste après (« …prodigio.fr/verdun »). L'écrire deux
 * fois en cent trente caractères sonne comme un publipostage, là où le but est
 * exactement l'inverse.
 *
 * Et aucun nom commun non plus — ni « la villa », ni « le bien ». Le premier
 * devient faux le jour où un bien s'appellera « Mas des Oliviers » ; le second
 * est du vocabulaire d'agence, pas de personne. « Votre brochure » marche pour
 * tout, et le possessif fait le travail que le nom aurait fait.
 *
 * Le lien est le lien court : il tient l'ensemble dans un seul SMS, il nomme
 * l'agence, et il survivra à un déménagement de la vitrine.
 */
export function composerMessage(input: {
  firstName?: string | null;
  brochureUrl?: string | null;
}): string | null {
  const lien = net(input.brochureUrl);
  /* Sans lien, l'accusé n'a plus d'objet : il annoncerait une brochure sans
     dire où elle est. Mieux vaut ne rien envoyer. */
  if (!lien) return null;

  const prenom = net(input.firstName);
  const salutation = prenom ? `Bonjour ${pourSms(prenom)},` : "Bonjour,";

  return `${salutation} voici votre brochure : ${lien}\n\nNous vous appelons très vite.\nJC & Antoine`;
}
