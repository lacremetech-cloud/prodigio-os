import "server-only";

import { env as globalEnv, isLumailConfigured, mandateCrmBaseUrl } from "@/config";
import type { Env } from "@/config";
import { createLumailProvider } from "@/modules/communications/providers/lumail";
import type { ProviderTransportOptions } from "@/modules/communications/providers/types";
import { meriteAlerteImmediate } from "./urgence";

/**
 * ALERTE E-MAIL À L'ÉQUIPE POUR CHAQUE NOUVEAU LEAD.
 *
 * Pourquoi en plus de Slack : Antoine et JC n'ouvrent ni Slack ni WhatsApp.
 * Une alerte que personne ne lit ne vaut pas mieux que pas d'alerte — on l'a
 * vérifié à nos dépens le 14 octobre. L'e-mail est le seul canal qu'ils
 * relèvent, donc c'est celui qui doit porter l'information.
 *
 * Ce module est VOLONTAIREMENT hors du dispatcher de communications. Ce
 * dernier sert à écrire aux PROSPECTS : il applique une politique de consentement,
 * une liste de désinscription et des modèles — tout cela gardé derrière
 * `COMMUNICATIONS_DISPATCH_ENABLED` en attendant la validation juridique.
 * Rien de cela ne s'applique ici : les destinataires sont deux collègues, sur
 * leur adresse professionnelle, pour faire leur travail. Les passer par la
 * mécanique prospect serait à la fois faux juridiquement et dangereux —
 * une alerte interne ne doit jamais pouvoir être avalée par une désinscription.
 *
 * Contrairement à l'alerte d'ÉCHEC, qui ne porte aucune coordonnée, celle-ci
 * en porte : son unique raison d'être est que le commercial décroche son
 * téléphone sans rien ouvrir. Le numéro est donc en premier, cliquable.
 *
 * Best-effort absolu : jamais d'exception, jamais de coordonnée journalisée.
 */

export interface FicheLead {
  nom: string | null;
  telephone: string | null;
  email: string | null;
  bien: string | null;
  /** Déjà en clair (« Plus d'1 M€ »), jamais le code technique. */
  budget: string | null;
  /**
   * Le CODE, lui, sert à décider si ce lead justifie une alerte immédiate.
   * Le libellé ne peut pas : il est traduit, et deux codes différents peuvent
   * porter le même mot.
   */
  budgetChoice: string | null;
  provenance: string | null;
  score: { overall: number | null; priority: string | null } | null;
  buyerProfileId: string | null;
  interestId: string;
  recuLe: Date;
}

export interface AlerteEmailResult {
  status: "sent" | "skipped" | "failed" | "partial";
  /** Nombre de destinataires réellement servis. Jamais leurs adresses. */
  envoyes: number;
  total: number;
}

const HORAIRE = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Neutralise ce qui casserait le Markdown ou ferait passer du balisage. */
function net(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  return s.replace(/[*_`[\]<>]/g, " ").replace(/\s+/g, " ").trim() || null;
}

/**
 * L'OBJET EST L'ALERTE.
 *
 * Sur un téléphone, la notification n'affiche que l'expéditeur et l'objet.
 * Tout ce qui permet de décider s'il faut rappeler maintenant doit donc tenir
 * là : qui, quel bien, quel budget. Le corps n'est que le détail.
 */
export function objetAlerte(lead: FicheLead): string {
  const morceaux = [net(lead.nom) ?? "Acquéreur", net(lead.bien), net(lead.budget)].filter(Boolean);
  return `Nouveau lead — ${morceaux.join(" · ")}`;
}

export function corpsAlerte(lead: FicheLead, env: Env = globalEnv): string {
  const tel = net(lead.telephone);
  const mail = net(lead.email);
  const lignes: string[] = [];

  lignes.push(`## ${net(lead.nom) ?? "Acquéreur"}`);
  lignes.push("");

  // Le rappel passe avant tout le reste : c'est la seule action qui compte,
  // et elle doit être à un doigt sur un téléphone.
  if (tel) lignes.push(`### [${tel}](tel:${tel.replace(/[^+0-9]/g, "")})`);
  else lignes.push("### Aucun téléphone transmis");
  lignes.push("");

  const faits: string[] = [];
  if (net(lead.bien)) faits.push(`**Bien** — ${net(lead.bien)}`);
  if (net(lead.budget)) faits.push(`**Budget annoncé** — ${net(lead.budget)}`);
  if (mail) faits.push(`**E-mail** — [${mail}](mailto:${mail})`);
  if (net(lead.provenance)) faits.push(`**Provenance** — ${net(lead.provenance)}`);
  if (lead.score?.overall != null) {
    const p = net(lead.score.priority);
    faits.push(`**Score** — ${lead.score.overall}/100${p ? ` · ${p}` : ""}`);
  }
  faits.push(`**Reçu le** — ${HORAIRE.format(lead.recuLe)}`);
  lignes.push(faits.join("  \n"));
  lignes.push("");

  const fiche = `${mandateCrmBaseUrl(env)}/crm/acquereurs${
    lead.buyerProfileId ? `/${encodeURIComponent(lead.buyerProfileId)}` : ""
  }`;
  lignes.push(`[Ouvrir la fiche dans Prodigio OS](${fiche})`);
  lignes.push("");
  lignes.push("---");
  lignes.push("");
  lignes.push("Alerte automatique de Prodigio OS. Ne pas répondre à cet expéditeur :");
  lignes.push("une réponse part directement à l'acquéreur.");

  return lignes.join("\n");
}

/**
 * Adresses valides, dédoublonnées, insensibles à la casse.
 *
 * Une adresse mal saisie ne doit pas priver les autres de leur alerte : on
 * écarte l'invalide et on sert le reste. L'inverse — tout refuser — ferait
 * d'une virgule en trop une panne de notification silencieuse.
 */
export function destinatairesValides(brut: string | null | undefined): string[] {
  if (!brut) return [];
  const vus = new Set<string>();
  const sorties: string[] = [];
  for (const part of brut.split(/[,;\s]+/)) {
    const a = part.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) continue;
    const cle = a.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    sorties.push(a);
  }
  return sorties;
}

export interface AlerteEmailDeps {
  env?: Env;
  transport?: ProviderTransportOptions;
}

export async function alerterEquipeParEmail(
  lead: FicheLead,
  deps: AlerteEmailDeps = {},
): Promise<AlerteEmailResult> {
  const env = deps.env ?? globalEnv;
  const destinataires = destinatairesValides(env.ALERTES_LEADS_EMAILS);

  if (!isLumailConfigured(env) || destinataires.length === 0) {
    return { status: "skipped", envoyes: 0, total: destinataires.length };
  }

  try {
    const lumail = createLumailProvider({
      apiKey: env.LUMAIL_API_KEY,
      fromAddress: env.LUMAIL_FROM_EMAIL,
      replyTo: env.LUMAIL_REPLY_TO,
    });

    const objet = objetAlerte(lead);
    const corps = corpsAlerte(lead, env);
    // Répondre à l'alerte écrit à l'acquéreur : c'est le geste naturel quand on
    // lit « nouveau lead » sur son téléphone, autant qu'il atteigne la bonne
    // personne. À défaut d'adresse acquéreur, le réglage du fournisseur reprend.
    const replyTo = net(lead.email);

    // Un envoi par destinataire : une adresse en panne ne doit pas emporter
    // l'alerte des autres. `allSettled` pour la même raison.
    const resultats = await Promise.allSettled(
      destinataires.map((to) =>
        lumail.send(
          { to, subject: objet, body: corps, bodyFormat: "markdown", replyTo },
          { timeoutMs: 8000, ...deps.transport },
        ),
      ),
    );

    const envoyes = resultats.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    if (envoyes === 0) return { status: "failed", envoyes, total: destinataires.length };
    if (envoyes < destinataires.length)
      return { status: "partial", envoyes, total: destinataires.length };
    return { status: "sent", envoyes, total: destinataires.length };
  } catch {
    // Muet sur le détail : il porterait l'adresse ou le contenu.
    console.error("alerte lead : echec d'envoi e-mail");
    return { status: "failed", envoyes: 0, total: destinataires.length };
  }
}

/* ===========================================================================
   SECOND CHEMIN : UN WEBHOOK, POUR QUE MAKE COMPOSE L'E-MAIL.
   ===========================================================================

   Pourquoi deux chemins pour une seule alerte : envoyer un e-mail exige un
   fournisseur autorise a ecrire au nom du domaine, donc un compte a ouvrir.
   Make, lui, est deja la et sait envoyer via le compte Google de l'agence.
   Le webhook est donc la route courte ; Lumail reste la route propre, le jour
   ou l'on voudra sortir de Make sans redevelopper.

   ATTENTION — ce webhook n'a RIEN a voir avec `buyer_form_webhook_url`, qui
   porte l'accuse de reception au prospect et n'est PLUS appele depuis que
   SMSFactor est configure (voir `universal-submit.ts` : l'envoi direct prime
   et sort de la fonction). Les confondre, c'est brancher une alerte sur une
   branche morte. */

export interface ChargeAlerteEquipe {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  property_name: string | null;
  budget_libelle: string | null;
  provenance: string | null;
  recu_le: string;
  fiche_url: string;
  interest_id: string;
  /**
   * Le tri d'urgence VOYAGE dans la charge, il ne filtre plus l'appel.
   * `true` : Make envoie l'alerte interne a Antoine, JC et Nicolas.
   * `false` : Make saute cette SEULE branche. Le premier contact automatique
   * part quand meme, et le lead reparait dans le recapitulatif de 8 h 30,
   * 13 h ou 17 h 30.
   */
  alerte_interne: boolean;
}

/** Ce que Make recoit. Les noms sont ceux cables dans le scenario. */
export function chargeAlerteEquipe(lead: FicheLead, env: Env = globalEnv): ChargeAlerteEquipe {
  const nom = (lead.nom ?? "").trim();
  const sep = nom.indexOf(" ");
  return {
    first_name: sep > 0 ? nom.slice(0, sep) : nom || null,
    last_name: sep > 0 ? nom.slice(sep + 1) : null,
    phone: net(lead.telephone),
    email: net(lead.email),
    property_name: net(lead.bien),
    budget_libelle: net(lead.budget),
    provenance: net(lead.provenance) ?? "Non transmise",
    recu_le: HORAIRE.format(lead.recuLe),
    fiche_url: `${mandateCrmBaseUrl(env)}/crm/acquereurs${
      lead.buyerProfileId ? `/${encodeURIComponent(lead.buyerProfileId)}` : ""
    }`,
    interest_id: lead.interestId,
    alerte_interne: meriteAlerteImmediate(
      { budgetChoice: lead.budgetChoice, recuLe: lead.recuLe },
      env.ALERTE_LEAD_IMMEDIATE,
    ),
  };
}

export async function alerterEquipeParWebhook(
  lead: FicheLead,
  deps: { env?: Env; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ status: "sent" | "skipped" | "failed" }> {
  const env = deps.env ?? globalEnv;
  const url = env.ALERTE_LEAD_WEBHOOK_URL;
  if (!url || !/^https:\/\//.test(url)) return { status: "skipped" };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 8000);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(chargeAlerteEquipe(lead, env)),
      signal: controller.signal,
    });
    return { status: res.ok ? "sent" : "failed" };
  } catch {
    // Ni l'adresse appelee ni les coordonnees ne sont journalisees.
    console.error("alerte lead : echec d'appel du webhook d'alerte");
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Point d'entree unique des deux tunnels.
 *
 * Le webhook PRIME : c'est le chemin actif aujourd'hui. Jamais les deux, sinon
 * Antoine recevrait deux fois la meme alerte — la meme regle que pour l'accuse
 * de reception, pour la meme raison.
 *
 * ET IL PART POUR CHAQUE LEAD, SANS CONDITION. Le meme webhook declenche
 * desormais le premier e-mail automatique a l'acquereur : le filtrer, c'est
 * laisser sans reponse celui dont le budget ne justifie pas de faire sonner un
 * portable. Le tri d'urgence ne decide donc plus QUI est appele, seulement si
 * l'alerte INTERNE part — il voyage dans `alerte_interne` et c'est Make qui
 * coupe cette seule branche.
 */
export async function alerterEquipe(
  lead: FicheLead,
  deps: AlerteEmailDeps & { fetchImpl?: typeof fetch } = {},
): Promise<{ canal: "webhook" | "email" | "aucun"; status: string }> {
  const env = deps.env ?? globalEnv;

  /* AUCUN TRI AVANT CE POST. La charge porte `alerte_interne` et c'est Make
     qui s'en sert pour n'ecarter que le mail interne. */
  if (env.ALERTE_LEAD_WEBHOOK_URL) {
    const r = await alerterEquipeParWebhook(lead, { env, fetchImpl: deps.fetchImpl });
    return { canal: "webhook", status: r.status };
  }

  /* Lumail, lui, ne sait porter QUE l'alerte interne — rien d'autre ne passe
     par ce tunnel. Le tri s'y applique donc directement, sans rien priver
     d'autre. Un lead ecarte ici n'est pas perdu : il part dans le
     recapitulatif de 8 h 30, 13 h ou 17 h 30. */
  if (
    !meriteAlerteImmediate(
      { budgetChoice: lead.budgetChoice, recuLe: lead.recuLe },
      env.ALERTE_LEAD_IMMEDIATE,
    )
  ) {
    return { canal: "aucun", status: "differe" };
  }

  const r = await alerterEquipeParEmail(lead, deps);
  return { canal: r.status === "skipped" ? "aucun" : "email", status: r.status };
}
