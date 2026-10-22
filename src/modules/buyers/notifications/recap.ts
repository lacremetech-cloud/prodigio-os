/**
 * LE RECAPITULATIF DES NOUVEAUX LEADS — 8h30, 13h00, 17h30.
 *
 * Il remplace les onze mails par jour que personne n'ouvrait. Son role n'est
 * pas d'annoncer une nouvelle mais de porter un INVENTAIRE : ce qui est arrive
 * depuis le precedent, et ce qui dort. C'est cette seconde partie qui rend
 * trois envois par jour acceptables sans rien perdre.
 *
 * Module PUR : il ne lit ni la base ni l'environnement, pour que la fenetre et
 * le rendu soient testables sans serveur.
 */

import { BUDGET_CHOICE_COURT, type BuyerBudgetChoice } from "@/modules/buyers/funnel/universal";
import { BUDGETS_AU_DESSUS_1M } from "./urgence";

/** Minutes depuis minuit, heure de Paris, des trois creneaux. */
export const CRENEAUX_MINUTES = [8 * 60 + 30, 13 * 60, 17 * 60 + 30] as const;

/** Tolerance autour d'un creneau : au-dela, l'appel est tenu pour manuel. */
const TOLERANCE_MINUTES = 90;

const MINUTES_PARIS = new Intl.DateTimeFormat("fr-FR", {
  hour: "numeric",
  minute: "numeric",
  hour12: false,
  timeZone: "Europe/Paris",
});

/** Minutes ecoulees depuis minuit a Paris. */
export function minutesDepuisMinuitParis(d: Date): number {
  const [h = "0", m = "0"] = MINUTES_PARIS.format(d).split(":");
  return (Number.parseInt(h, 10) % 24) * 60 + Number.parseInt(m, 10);
}

/**
 * DEPUIS QUAND COMPTER.
 *
 * On ne prend pas « les N dernieres heures » : un envoi parti a 13h04 au lieu
 * de 13h00 rendrait alors un tableau tronque de quatre minutes, et quatre
 * leads disparaitraient sans que personne ne le sache.
 *
 * On raisonne donc en creneaux : on identifie celui pour lequel cet appel a
 * lieu, puis on remonte au creneau PRECEDENT. Un retard de quelques minutes
 * est sans effet, et deux appels dans le meme creneau rendent la meme fenetre.
 */
export function fenetreRecap(maintenant: Date): { debut: Date; manuel: boolean } {
  const m = minutesDepuisMinuitParis(maintenant);

  // Tous les creneaux des trois derniers jours, exprimes en minutes ECOULEES.
  // Une valeur negative est un creneau legerement a venir (avance d'horloge).
  const ecoules: number[] = [];
  for (let jour = 0; jour <= 3; jour += 1) {
    for (const creneau of CRENEAUX_MINUTES) {
      ecoules.push(m - creneau + 1440 * jour);
    }
  }
  ecoules.sort((a, b) => a - b);

  const candidats = ecoules.filter((v) => v >= -TOLERANCE_MINUTES);
  const proche = candidats.find((v) => Math.abs(v) <= TOLERANCE_MINUTES);
  const courant = proche ?? candidats.find((v) => v >= 0) ?? 0;
  const precedent = candidats.find((v) => v > courant) ?? courant + 1440;

  return {
    debut: new Date(maintenant.getTime() - precedent * 60_000),
    manuel: proche === undefined,
  };
}

export interface LeadRecap {
  nom: string | null;
  telephone: string | null;
  bien: string | null;
  budgetChoice: string | null;
  recuLe: Date;
  ficheUrl: string;
  /** Un mail immediat est deja parti pour ce lead. */
  dejaAlerte: boolean;
}

/**
 * CE QUI DORT — AVEC LE VOCABULAIRE DU CRM, PAS UN TROISIEME.
 *
 * « En retard » et « Sans action » existent deja comme signaux et comme
 * filtres d'URL. Les reprendre tels quels garantit que le nombre annonce dans
 * le mail ouvre EXACTEMENT la liste correspondante. Un seuil maison du genre
 * « depuis 48 h » aurait annonce un chiffre qu'aucun ecran n'affiche.
 */
export interface DossiersDormants {
  enRetard: number;
  sansAction: number;
  urlEnRetard: string;
  urlSansAction: string;
}

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Rien de ce qui vient d'un formulaire ne doit pouvoir porter du balisage. */
export function echappe(v: string | null | undefined): string {
  return (v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function libelle(code: string | null): string {
  if (!code) return "Sans réponse";
  return BUDGET_CHOICE_COURT[code as BuyerBudgetChoice] ?? code;
}

function estAuDessus1M(code: string | null): boolean {
  return !!code && BUDGETS_AU_DESSUS_1M.includes(code);
}

/**
 * L'OBJET PORTE LA DECISION.
 *
 * Sur un telephone la notification n'affiche que l'expediteur et l'objet : il
 * doit suffire a savoir s'il faut ouvrir maintenant ou ce soir.
 */
export function sujetRecap(leads: readonly LeadRecap[]): string {
  const n = leads.length;
  const gros = leads.filter((l) => estAuDessus1M(l.budgetChoice)).length;
  const tete = n === 1 ? "1 nouveau lead" : `${n} nouveaux leads`;
  if (gros === 0) return tete;
  return `${tete} — ${gros === 1 ? "1 au-dessus de 1 M€" : `${gros} au-dessus de 1 M€`}`;
}

function blocPrioritaire(l: LeadRecap): string {
  const tel = (l.telephone ?? "").replace(/[^+0-9]/g, "");
  const marque = l.dejaAlerte
    ? ` · <span style="color:#8a99a5">déjà alerté par mail</span>`
    : "";
  return `<table cellpadding="0" cellspacing="0" width="100%" style="border-top:2px solid #1B4F6B;margin:0 0 2px"><tr><td style="padding:14px 0 4px"><span style="display:inline-block;background:#1B4F6B;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:2px 7px;border-radius:3px;vertical-align:middle">${echappe(
    libelle(l.budgetChoice).toUpperCase(),
  )}</span><span style="font-size:17px;font-weight:700;margin-left:7px">${echappe(
    l.nom ?? "Acquéreur",
  )}</span></td></tr><tr><td style="padding:0 0 10px;font-size:14px;color:#5a6b78">${echappe(
    l.bien ?? "Bien non précisé",
  )} · ${HEURE.format(l.recuLe)}${marque}</td></tr><tr><td style="padding:0 0 18px">${
    tel
      ? `<a href="tel:${echappe(tel)}" style="display:inline-block;padding:11px 20px;background:#1B4F6B;color:#fff;text-decoration:none;border-radius:8px;font-size:17px;font-weight:700">${echappe(
          l.telephone,
        )}</a>`
      : `<span style="color:#8a99a5;font-size:15px">Aucun téléphone transmis</span>`
  }<a href="${echappe(
    l.ficheUrl,
  )}" style="color:#2E7C9B;font-weight:600;font-size:14px;margin-left:14px">Ouvrir la fiche</a></td></tr></table>`;
}

function ligneSimple(l: LeadRecap): string {
  const tel = (l.telephone ?? "").replace(/[^+0-9]/g, "");
  return `<tr style="border-top:1px solid #e3e8ec"><td style="padding:11px 10px 11px 0"><span style="font-weight:600">${echappe(
    l.nom ?? "Acquéreur",
  )}</span><br><span style="font-size:13px;color:#5a6b78">${echappe(
    l.bien ?? "Bien non précisé",
  )} · ${HEURE.format(
    l.recuLe,
  )}</span></td><td align="right" style="padding:11px 0;white-space:nowrap">${
    tel
      ? `<a href="tel:${echappe(tel)}" style="color:#1B4F6B;font-weight:700;text-decoration:none;font-size:16px">${echappe(
          l.telephone,
        )}</a>`
      : `<span style="color:#8a99a5;font-size:14px">pas de numéro</span>`
  }<br><a href="${echappe(l.ficheUrl)}" style="color:#2E7C9B;font-size:13px">fiche</a></td></tr>`;
}

function groupe(titre: string, leads: readonly LeadRecap[]): string {
  if (leads.length === 0) return "";
  return `<p style="margin:26px 0 8px;font-size:11.5px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#8a99a5">${echappe(
    titre,
  )}</p><table cellpadding="0" cellspacing="0" width="100%" style="font-size:15px">${leads
    .map(ligneSimple)
    .join("")}</table>`;
}

/**
 * Le bandeau du bas n'apparait que s'il a quelque chose a dire : zero en
 * retard et zero sans action, c'est une bonne nouvelle, pas une ligne de plus.
 */
function pied(d: DossiersDormants): string {
  if (d.enRetard === 0 && d.sansAction === 0) return "";
  const morceaux: string[] = [];
  if (d.enRetard > 0) {
    morceaux.push(
      `<a href="${echappe(d.urlEnRetard)}" style="color:#2E7C9B;font-weight:600">${
        d.enRetard === 1 ? "1 dossier en retard" : `${d.enRetard} dossiers en retard`
      }</a>`,
    );
  }
  if (d.sansAction > 0) {
    morceaux.push(
      `<a href="${echappe(d.urlSansAction)}" style="color:#2E7C9B;font-weight:600">${
        d.sansAction === 1 ? "1 sans prochaine action" : `${d.sansAction} sans prochaine action`
      }</a>`,
    );
  }
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0 0;background:#f6f8f9;border-radius:8px"><tr><td style="padding:14px 16px"><p style="margin:0;font-size:15px">${morceaux.join(
    ' <span style="color:#c3ccd3">·</span> ',
  )}</p></td></tr></table>`;
}

export interface Recap {
  envoyer: boolean;
  sujet: string;
  html: string;
  nombre: number;
}

/**
 * UN CRENEAU SANS NOUVEAU LEAD N'ENVOIE RIEN.
 *
 * Un mail « 0 nouveau lead » serait exactement la pollution qu'on supprime.
 * Make applique ce booleen en filtre devant le module d'envoi.
 */
export function construireRecap(entree: {
  leads: readonly LeadRecap[];
  dormants: DossiersDormants;
  maintenant: Date;
  depuis: Date;
}): Recap {
  const { leads, dormants, maintenant, depuis } = entree;
  if (leads.length === 0) {
    return { envoyer: false, sujet: sujetRecap(leads), html: "", nombre: 0 };
  }

  const tri = [...leads].sort((a, b) => a.recuLe.getTime() - b.recuLe.getTime());
  const gros = tri.filter((l) => estAuDessus1M(l.budgetChoice));
  const moyens = tri.filter((l) => l.budgetChoice === "500k_1m");
  const reste = tri.filter((l) => !estAuDessus1M(l.budgetChoice) && l.budgetChoice !== "500k_1m");

  const tete = leads.length === 1 ? "1 nouveau lead" : `${leads.length} nouveaux leads`;

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;color:#141f27;line-height:1.5"><p style="margin:0 0 2px;font-size:20px;font-weight:700">${tete}</p><p style="margin:0 0 24px;font-size:14px;color:#5a6b78">Depuis le récapitulatif de ${HEURE.format(
    depuis,
  )} — ${DATE_LONGUE.format(maintenant)}</p>${gros
    .map(blocPrioritaire)
    .join("")}${groupe(libelle("500k_1m"), moyens)}${groupe(
    "Sans projet déclaré ou sans réponse",
    reste,
  )}${pied(dormants)}<p style="margin:26px 0 0;padding-top:14px;border-top:1px solid #e3e8ec;font-size:13px;color:#8a99a5">Récapitulatif automatique de Prodigio OS — 8h30, 13h00, 17h30. Un créneau sans nouveau lead n'envoie rien.</p></div>`;

  return { envoyer: true, sujet: sujetRecap(leads), html, nombre: leads.length };
}
