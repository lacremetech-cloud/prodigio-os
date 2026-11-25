import "server-only";
import { CHALET_6511 } from "@/content/briefs/chalet-6511";

/**
 * LE REGISTRE DES BRIEFS.
 *
 * Un brief est un dossier de production : prix, lots, galeries, entretien avec
 * le mandataire, plan de tournage, interdits de communication. Il se lit sur
 * place, par des gens qui ne sont pas de la maison.
 *
 * POURQUOI UN FICHIER, ET PAS UNE BASE DE DONNÉES. Trois biens, quelques
 * briefs par an, chacun écrit à la main pendant des heures. Une machine à
 * fabriquer des briefs — table, écran d'administration, éditeur — coûterait
 * quatre jours et trois tables à maintenir pour un problème qui n'en vaut pas
 * le prix. Le jour où il en faut un par semaine, on la construira ; d'ici là,
 * ajouter un brief, c'est ajouter une entrée ici.
 *
 * ET POURQUOI LE BRIEF EST ÉCRIT, PAS GÉNÉRÉ. « Mur rouge à garder hors
 * champ », « ne jamais dire huit mois », « le prix a déjà baissé, argument de
 * closing, jamais de publicité » : aucun gabarit ne produit ces phrases-là.
 * Le CRM est le coffre et la porte, il n'est pas l'auteur.
 */
export interface Brief {
  /** Ce qui apparaît dans l'URL. Dictable au téléphone. */
  slug: string;
  titre: string;
  bien: string;
  ville: string;
  /** La vignette de la grille, dans `public/briefs/...`. */
  couverture: string;
  /** Une ligne sous le titre, sur la grille. Jamais de prix ni d'état : la
      grille est PUBLIQUE, seul le document est derrière le code. */
  sousTitre: string;
  /**
   * Empreinte scrypt du code. Le code lui-même n'est écrit nulle part — ni
   * ici, ni en base, ni dans un journal. Le changer, c'est remplacer cette
   * ligne, et tous les navigateurs qui avaient déjà saisi l'ancien sont
   * déconnectés d'office.
   */
  empreinteDuCode: string;
  document: string;
}

export const BRIEFS: readonly Brief[] = [
  {
    slug: "chalet-6511",
    titre: "Le chalet du docteur",
    bien: "Chalet 6511",
    ville: "Les Deux Alpes",
    couverture: "/briefs/chalet-6511-m4k7qz/img/salon-charpente.jpg",
    sousTitre: "Tournage du 2 décembre · mandat Cimalpes",
    empreinteDuCode:
      "scrypt$16384$8$1$d072dfbfd732bb4da746dd18d4615814$a82dd4d91ac42f281b62599fd786a9d578a89313d7808d84673b91327baccf6b",
    document: CHALET_6511,
  },
];

export function briefParSlug(slug: string): Brief | null {
  return BRIEFS.find((b) => b.slug === slug) ?? null;
}
