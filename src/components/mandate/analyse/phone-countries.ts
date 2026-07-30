import {
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

/**
 * Liste des pays pour le sélecteur téléphonique international.
 *
 * Les données (indicatifs, pays) viennent de `libphonenumber-js` (fondé sur
 * libphonenumber de Google) ; les **noms français** sont fournis à l'exécution
 * par `Intl.DisplayNames` (aucune table à maintenir) ; le **drapeau** est un
 * emoji dérivé du code ISO (aucun asset). Construit une seule fois (cache).
 */

export interface CountryOption {
  iso: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

/** Emoji drapeau à partir d'un code ISO 3166-1 alpha-2 (indicateurs régionaux). */
function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

let cache: CountryOption[] | null = null;

export function getCountryOptions(): CountryOption[] {
  if (cache) return cache;

  let display: Intl.DisplayNames | null = null;
  try {
    display = new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    display = null;
  }

  const options = getCountries().map<CountryOption>((iso) => ({
    iso,
    name: display?.of(iso) ?? iso,
    dialCode: getCountryCallingCode(iso),
    flag: flagEmoji(iso),
  }));
  options.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  cache = options;
  return options;
}

export function findCountry(iso: string): CountryOption | undefined {
  const upper = iso.toUpperCase();
  return getCountryOptions().find((c) => c.iso === upper);
}
