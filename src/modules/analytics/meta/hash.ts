import { createHash } from "node:crypto";

/**
 * Normalisation et empreinte des données de correspondance envoyées à Meta.
 *
 * Meta attend des valeurs **normalisées puis hachées en SHA-256**, et compare
 * ces empreintes à celles de ses propres utilisateurs. La normalisation n'est
 * donc pas cosmétique : une majuscule de trop et la correspondance échoue
 * silencieusement, sans la moindre erreur à l'envoi. Tout est ici, pur et
 * testable, plutôt qu'éparpillé dans les appels.
 *
 * Aucune valeur en clair ne quitte ce module : les fonctions ne renvoient que
 * des empreintes.
 */

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Renvoie `null` plutôt qu'une empreinte de chaîne vide — qui ne correspondrait à personne. */
function empreinte(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length === 0 ? null : sha256(v);
}

/** E-mail : espaces retirés, minuscules. Aucune autre transformation. */
export function hashEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const v = email.trim().toLowerCase();
  if (v.length === 0 || !v.includes("@")) return null;
  return sha256(v);
}

/**
 * Téléphone : chiffres uniquement, indicatif pays compris, sans `+` ni zéros
 * de tête. `+33 6 12 34 56 78` devient `33612345678`.
 *
 * Un numéro national (`06…`) sans indicatif ne correspondra à personne chez
 * Meta : on exige donc une forme internationale, et on renvoie `null` sinon
 * plutôt que d'envoyer une empreinte qui ne servira à rien.
 */
export function hashPhone(phone: string | null | undefined): string | null {
  if (typeof phone !== "string") return null;
  const trimmed = phone.trim();
  // On exige la forme internationale explicite (`+33…` ou `0033…`). Un `06…`
  // devenu `612345678` aurait la longueur d'un numero valide et partirait sans
  // bruit : Meta ne le rattacherait a personne, et rien ne le signalerait.
  // Tous les numeros de l'application sont normalises en E.164 en amont.
  if (!/^(\+|00)/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D+/g, "").replace(/^0+/, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return sha256(digits);
}

/** Nom et prénom : minuscules, sans espaces ni ponctuation, accents conservés. */
export function hashName(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const v = name
    .trim()
    .toLowerCase()
    .replace(/[\s.'"`\-_,]+/g, "");
  return empreinte(v);
}

/** Pays : code ISO 3166-1 alpha-2 en minuscules (`FR` → `fr`). */
export function hashCountry(country: string | null | undefined): string | null {
  if (typeof country !== "string") return null;
  const v = country.trim().toLowerCase();
  return /^[a-z]{2}$/.test(v) ? sha256(v) : null;
}

/** Ville : minuscules, sans espaces ni ponctuation. */
export function hashCity(city: string | null | undefined): string | null {
  return hashName(city);
}

/**
 * Reconstitue le cookie `_fbc` à partir du `fbclid` porté par l'URL de la
 * publicité. Format imposé par Meta : `fb.1.<horodatage ms>.<fbclid>`.
 *
 * C'est le signal d'attribution le plus fort dont nous disposions côté serveur :
 * le formulaire vit dans une iframe, les cookies de la page d'atterrissage nous
 * sont donc inaccessibles, mais le `fbclid` nous est transmis avec la demande.
 */
export function buildFbc(
  fbclid: string | null | undefined,
  clickedAt: Date | string | null | undefined,
): string | null {
  if (typeof fbclid !== "string" || fbclid.trim().length === 0) return null;
  const date = clickedAt ? new Date(clickedAt) : new Date();
  const ms = Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
  return `fb.1.${ms}.${fbclid.trim()}`;
}
