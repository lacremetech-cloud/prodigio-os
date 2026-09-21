/**
 * Vitrine — les **écrins réels** déjà produits par Prodigio, montrés en direct
 * sur la landing propriétaire.
 *
 * Montrer l'écrin vaut mieux que le décrire : le visiteur ouvre le site du bien
 * et feuillette la brochure, exactement comme le ferait un acquéreur.
 *
 * 👉 Pour présenter un autre bien, il suffit de changer les URL ci-dessous
 *    (ou de définir les variables d'environnement correspondantes). Les pages
 *    sont **intégrées**, jamais recopiées ni réhébergées.
 */

export interface ShowcaseProperty {
  /** Nom du bien tel qu'il apparaît sur son écrin. */
  readonly name: string;
  /** Localisation courte, pour situer sans en dire trop. */
  readonly place: string;
  /** Site dédié au bien. */
  readonly siteUrl: string;
  /** Brochure confidentielle, feuilletable. */
  readonly brochureUrl: string;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SHOWCASE_SITE_URL?.trim() ||
  "https://lecambredaze.vercel.app/";

/**
 * Bien de démonstration. La brochure vit sur le même écrin que le site : on la
 * dérive de l'URL du site pour qu'un changement de vitrine reste une seule
 * ligne à modifier.
 */
export const SHOWCASE: ShowcaseProperty = {
  name: "Chalet Mitja",
  place: "Font-Romeu · Pyrénées",
  siteUrl: SITE_URL,
  brochureUrl:
    process.env.NEXT_PUBLIC_SHOWCASE_BROCHURE_URL?.trim() ||
    new URL("brochure/", SITE_URL).toString(),
};
