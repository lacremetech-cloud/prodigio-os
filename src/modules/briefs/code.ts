import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * LA SERRURE D'UN BRIEF.
 *
 * Un brief part à des vidéastes, des monteurs, des setters — des gens qui
 * n'auront jamais de compte, et à qui on ne va pas demander d'en créer un pour
 * lire un document pendant un tournage d'une journée. Donc : un lien, un code,
 * dicté au téléphone.
 *
 * CE QUE LE CODE PROTÈGE, ET CE QU'IL NE PROTÈGE PAS. Il arrête les passants
 * et les moteurs de recherche. Il n'arrête pas quelqu'un qui transmet le code
 * à un tiers. C'est un arbitrage assumé : des comptes nominatifs seraient plus
 * sûrs, et personne ne les utiliserait pour une journée de tournage.
 *
 * LE CODE N'EXISTE NULLE PART EN CLAIR. Ni dans le dépôt, ni en base, ni dans
 * un journal : seule son empreinte scrypt est écrite. Perdre un code oblige à
 * en poser un nouveau — c'est voulu.
 */

/** scrypt : lent par construction, donc coûteux à essayer en masse. */
const COUT = 16_384;
const BLOC = 8;
const PARALLELE = 1;
const LONGUEUR = 32;

/** Empreinte au format `scrypt$cout$bloc$parallele$sel$empreinte`, en hexadécimal. */
export function empreinteDuCode(code: string): string {
  const sel = randomBytes(16);
  const cle = scryptSync(code.normalize("NFKC"), sel, LONGUEUR, {
    N: COUT,
    r: BLOC,
    p: PARALLELE,
  });
  return `scrypt$${COUT}$${BLOC}$${PARALLELE}$${sel.toString("hex")}$${cle.toString("hex")}`;
}

/**
 * Comparaison à temps CONSTANT. Un `===` sur des empreintes rendrait la main
 * d'autant plus tôt que le début diffère : on lirait le code caractère par
 * caractère en chronométrant les réponses.
 */
export function codeCorrespond(code: string, empreinte: string): boolean {
  const parts = empreinte.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const cout = Number(parts[1]);
  const bloc = Number(parts[2]);
  const parallele = Number(parts[3]);
  const sel = Buffer.from(parts[4] ?? "", "hex");
  const attendu = Buffer.from(parts[5] ?? "", "hex");
  if (!Number.isFinite(cout) || !Number.isFinite(bloc) || !Number.isFinite(parallele)) return false;
  if (sel.length === 0 || attendu.length === 0) return false;
  try {
    const calcule = scryptSync(code.normalize("NFKC"), sel, attendu.length, {
      N: cout,
      r: bloc,
      p: parallele,
    });
    return timingSafeEqual(calcule, attendu);
  } catch {
    return false;
  }
}

/**
 * LE JETON DE LECTURE, pour ne pas retaper le code à chaque section.
 *
 * Signé par l'empreinte du code elle-même, qui ne quitte jamais le serveur :
 * impossible à fabriquer de l'extérieur, et **changer le code invalide
 * automatiquement tous les jetons déjà remis**. Sans cette propriété, changer
 * un code laisserait entrer tous ceux qui avaient saisi l'ancien — on croirait
 * avoir refermé la porte.
 */
export function jetonDeLecture(slug: string, empreinte: string): string {
  return createHmac("sha256", empreinte).update(`brief:${slug}`).digest("hex");
}

export function jetonValide(slug: string, empreinte: string, jeton: string | undefined): boolean {
  if (!jeton) return false;
  const attendu = jetonDeLecture(slug, empreinte);
  if (jeton.length !== attendu.length) return false;
  return timingSafeEqual(Buffer.from(jeton), Buffer.from(attendu));
}

export const nomDuCookie = (slug: string) => `brief_${slug}`;

/**
 * Alphabet SANS caractères ambigus : ni O ni 0, ni I ni 1, ni l. Un code se
 * dicte au téléphone, et « zéro ou O ? » est la première cause d'un code qui
 * « ne marche pas ».
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Un code lisible, en trois groupes de quatre : 32^12 combinaisons. */
export function tirerUnCode(): string {
  const brut = randomBytes(12);
  const lettres = [...brut].map((o) => ALPHABET[o % ALPHABET.length]).join("");
  return `${lettres.slice(0, 4)}-${lettres.slice(4, 8)}-${lettres.slice(8, 12)}`;
}

/** On compare sans se soucier de la casse ni des tirets oubliés. */
export function normaliserLaSaisie(saisie: string): string {
  return saisie.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
