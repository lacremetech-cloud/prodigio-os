import "server-only";

import { env as globalEnv, isLumailConfigured, mandateCrmBaseUrl } from "@/config";
import type { Env } from "@/config";
import { createLumailProvider } from "@/modules/communications/providers/lumail";
import type { ProviderTransportOptions } from "@/modules/communications/providers/types";

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
