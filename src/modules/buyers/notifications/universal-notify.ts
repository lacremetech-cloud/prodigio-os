import "server-only";

import { env, isBuyerSlackConfigured, mandateCrmBaseUrl } from "@/config";
import { postSlackWebhook } from "@/modules/mandates/notifications/slack";
import type { UniversalSubmissionRequest } from "../funnel/universal-payload";
import type { FicheLead } from "./alerte-email";

/**
 * Alerte Slack pour une demande déposée par le **formulaire universel**, celui
 * qui vit sur les landing pages des biens.
 *
 * Le tunnel historique a déjà la sienne (`notifyNewBuyerInterest`), mais il
 * collecte neuf réponses — nature du projet, financement, horizon, mobilité —
 * que le formulaire universel ne demande pas : il va droit au budget et aux
 * coordonnées. Réutiliser son message produirait une alerte pleine de trous.
 * Celle-ci ne dit que ce qui a réellement été saisi.
 *
 * Best-effort absolu : une panne Slack ne doit jamais remonter jusqu'au
 * visiteur, dont la demande est déjà enregistrée quand on arrive ici. Rien
 * n'est journalisé qui ressemble à une coordonnée ou à un webhook.
 */

export interface AlerteAcquereurInput {
  request: UniversalSubmissionRequest;
  interestId: string;
  propertyId: string;
  propertyName: string | null;
  buyerProfileId: string | null;
  /** Scores relus en base après l'insertion, jamais recalculés ici. */
  score: {
    overall: number | null;
    priority: string | null;
    budget: number | null;
  } | null;
}

const BUDGETS: Record<string, string> = {
  aucun_projet: "Aucun projet déclaré",
  "500k_1m": "500 k€ à 1 M€",
  plus_1m: "Plus d'1 M€",
  "1m_2m": "1 à 2 M€",
  "2m_3m": "2 à 3 M€",
  plus_3m: "Plus de 3 M€",
};

const PRIORITES: Record<string, string> = {
  a_qualifier: "À qualifier",
  haute: "Haute",
  moyenne: "Moyenne",
  basse: "Basse",
};

/** Neutralise ce qui pourrait être interprété comme du balisage Slack. */
function net(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);
}

/**
 * D'ou vient cette demande, en une ligne.
 *
 * La campagne et l'annonce priment sur la source : savoir qu'un acquereur
 * vient d'Instagram ne dit pas QUELLE publicite a ete payee pour l'amener.
 * Un `fbclid` sans campagne est signale comme tel plutot que tu : il veut dire
 * que la publicite ne transmet pas ses parametres de suivi.
 */
export function origineDeLaDemande(
  contexte: AlerteAcquereurInput["request"]["context"],
): string | null {
  const t = contexte.lastTouch ?? contexte.firstTouch ?? null;
  if (!t) return null;
  const campagne = net(t.utm_campaign);
  const annonce = net(t.utm_content);
  const source = [net(t.utm_source), net(t.utm_medium)].filter(Boolean).join(" · ");
  if (campagne || annonce) {
    const titre = [campagne, annonce].filter(Boolean).join(" › ");
    return source ? `${titre} (${source})` : titre;
  }
  if (source) return source;
  if (net(t.fbclid)) return "Publicité Meta · campagne non transmise";
  if (net(t.gclid)) return "Publicité Google · campagne non transmise";
  return null;
}

export function construireAlerte(input: AlerteAcquereurInput) {
  const a = input.request.answers;
  const nom = net(`${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()) ?? "Acquéreur";
  const bien = net(input.propertyName) ?? "Bien non nommé";
  const budget = BUDGETS[a.budgetChoice ?? ""] ?? "Budget non précisé";
  const lien = `${mandateCrmBaseUrl()}/crm/acquereurs${
    input.buyerProfileId ? `/${encodeURIComponent(input.buyerProfileId)}` : ""
  }`;

  const champs: string[] = [`*Bien*\n${bien}`, `*Budget annoncé*\n${budget}`];
  const provenance = origineDeLaDemande(input.request.context);
  if (provenance) champs.push(`*Provenance*\n${provenance}`);
  if (net(a.phoneRaw)) champs.push(`*Téléphone*\n${net(a.phoneRaw)}`);
  if (net(a.emailRaw)) champs.push(`*E-mail*\n${net(a.emailRaw)}`);
  if (input.score?.overall != null) {
    const p = input.score.priority ? PRIORITES[input.score.priority] ?? input.score.priority : null;
    champs.push(`*Score*\n${input.score.overall}/100${p ? ` · ${p}` : ""}`);
  }

  return {
    text: `Nouvelle demande acquéreur — ${nom} · ${bien}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "Nouvelle demande acquéreur", emoji: false } },
      { type: "section", text: { type: "mrkdwn", text: `*${nom}*` } },
      { type: "section", fields: champs.map((text) => ({ type: "mrkdwn", text })) },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Ouvrir la fiche", emoji: false },
            url: lien,
          },
        ],
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `Prodigio OS · Intérêt \`${net(input.interestId)}\`` }],
      },
    ],
  };
}

/**
 * Traduit une demande du formulaire universel en fiche d'alerte e-mail.
 *
 * Vit ICI et non dans le module e-mail : c'est ici que sont tenus les libelles
 * de budget et la lecture de provenance, et les dupliquer ailleurs garantirait
 * qu'un jour les deux canaux n'annoncent plus la meme chose. Les valeurs
 * partent BRUTES — le module e-mail a son propre nettoyage, celui de ce
 * fichier echappe pour Slack et casserait le Markdown.
 */
export function ficheLeadUniverselle(
  input: AlerteAcquereurInput,
  recuLe: Date = new Date(),
): FicheLead {
  const a = input.request.answers;
  const nom = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
  return {
    nom: nom || null,
    telephone: a.phoneRaw ?? null,
    email: a.emailRaw ?? null,
    bien: input.propertyName,
    budget: BUDGETS[a.budgetChoice ?? ""] ?? null,
    budgetChoice: a.budgetChoice ?? null,
    provenance: origineDeLaDemande(input.request.context),
    score: input.score
      ? {
          overall: input.score.overall,
          priority: input.score.priority
            ? PRIORITES[input.score.priority] ?? input.score.priority
            : null,
        }
      : null,
    buyerProfileId: input.buyerProfileId,
    interestId: input.interestId,
    recuLe,
  };
}

export async function alerterNouvelleDemande(
  input: AlerteAcquereurInput,
): Promise<{ status: "sent" | "skipped" | "failed" }> {
  try {
    if (!isBuyerSlackConfigured()) return { status: "skipped" };
    const webhook = env.SLACK_BUYER_LEADS_WEBHOOK_URL;
    if (!webhook) return { status: "skipped" };
    const res = await postSlackWebhook(webhook, construireAlerte(input));
    return { status: res.ok ? "sent" : "failed" };
  } catch {
    // Volontairement muet sur le détail : il contiendrait le webhook ou le
    // message, donc des coordonnées.
    console.error("alerte acquereur : echec d'envoi Slack");
    return { status: "failed" };
  }
}

/**
 * UN DEPOT QUI ECHOUE DOIT CRIER.
 *
 * Le 14 octobre au soir, une contrainte de base s'est mise a refuser la
 * creation des dossiers acquereurs. Pendant vingt-deux heures, 65 depots ont
 * ete rejetes : le visiteur lisait « Une erreur est survenue », et PERSONNE
 * n'a rien su. Ni alerte, ni compteur a zero visible — les depots des
 * personnes deja connues continuaient de passer. On ne l'a decouvert qu'en
 * essayant soi-meme le formulaire, apres avoir depense la publicite.
 *
 * Le succes etait annonce dans Slack ; l'echec, non. C'etait l'asymetrie la
 * plus couteuse du systeme.
 *
 * AUCUNE COORDONNEE N'EST ENVOYEE. On ne sait pas si la personne consentira a
 * ce que son nom circule, et le message part vers un service tiers : il ne
 * porte que le bien, l'etape qui a echoue et le code technique. Ce qu'il faut
 * pour agir dans la minute, rien de plus.
 */
export async function alerterDepotEnEchec(input: {
  slug: string;
  etape: "enregistrement" | "exception";
  code?: string | null;
}): Promise<{ status: "sent" | "skipped" | "failed" }> {
  try {
    if (!isBuyerSlackConfigured()) return { status: "skipped" };
    const webhook = env.SLACK_BUYER_LEADS_WEBHOOK_URL;
    if (!webhook) return { status: "skipped" };
    const quoi =
      input.etape === "enregistrement"
        ? "la base a refuse l'enregistrement"
        : "une erreur inattendue a interrompu le depot";
    const texte =
      `:rotating_light: *DÉPÔT ACQUÉREUR PERDU* — ${input.slug}\n` +
      `Un visiteur a rempli le formulaire et ${quoi}. ` +
      `Sa demande n'a été enregistrée nulle part.` +
      (input.code ? `\nCode technique : \`${input.code}\`` : "") +
      `\nÀ regarder tout de suite : chaque minute qui passe est de la publicité perdue.`;
    const res = await postSlackWebhook(webhook, {
      text: texte,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: texte } }],
    });
    return { status: res.ok ? "sent" : "failed" };
  } catch {
    /* Muet sur le detail : il contiendrait le webhook. */
    console.error("alerte depot en echec : echec d'envoi Slack");
    return { status: "failed" };
  }
}
