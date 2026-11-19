/**
 * CE QU'ON ATTEND COMME RETOUR APRÈS UN APPEL.
 *
 * « Structure l'IA en mode : c'est quoi les prochaines étapes ? Qu'elle nous
 * fasse le template type de ce qu'on attend comme retour. »
 *
 * Le gabarit ci-dessous est la réponse à cette phrase. Il n'est pas décoratif :
 * c'est lui qui fait qu'une note dictée en marchant et une note tapée le soir
 * se lisent pareil, et qu'on retrouve la même information à la même place sur
 * les quarante-six dossiers du vivier.
 *
 * POURQUOI CES QUATRE SECTIONS ET PAS SIX. Chacune répond à une question qu'on
 * se pose vraiment avant de rappeler quelqu'un :
 *   — « Il cherche quoi ? » pour mettre un bien en face ;
 *   — « Où ça coince ? » pour ne pas refaire l'appel précédent ;
 *   — « Il s'est dit quoi ? » pour le contexte ;
 *   — « Je fais quoi, et quand ? » pour que la note serve à quelque chose.
 * Une cinquième section serait une section que personne ne lit.
 *
 * Module NEUTRE — ni serveur, ni client : la consigne est du texte, et un test
 * doit pouvoir la lire sans clé d'API ni réseau.
 */

/** Les sections, dans l'ordre où elles sont écrites et lues. */
export const SECTIONS_NOTE = [
  "Ce que la personne cherche",
  "Points de blocage",
  "Ce qui s'est dit",
  "Prochaine étape",
] as const;

/**
 * La consigne donnée au modèle.
 *
 * TROIS INTERDITS, et ils comptent plus que le reste. Une note d'appel est une
 * trace commerciale : elle est relue des semaines plus tard par quelqu'un qui
 * n'était pas là, et sert à décider qui rappeler. Une phrase inventée, même
 * plausible, y fait plus de dégâts qu'un trou.
 *
 *  1. Ne rien ajouter qui ne soit pas dans la matière fournie. Pas de budget
 *     déduit, pas de ville supposée, pas de date reconstituée.
 *  2. Écrire « non précisé » plutôt que de combler. Un trou se voit et se
 *     comble au prochain appel ; une invention se propage.
 *  3. Garder les mots de la personne quand ils sont précis — « vue mer »,
 *     « pas avant septembre » — plutôt que de les reformuler en plus vague.
 */
export const CONSIGNE_NOTE = `Tu mets en forme la note d'un commercial immobilier après un échange avec un acquéreur.

Tu reçois sa dictée ou le transcript brut de l'échange. Tu rends UNIQUEMENT la note mise en forme, sans préambule, sans commentaire, sans te présenter.

Le format est fixe. Quatre sections, dans cet ordre, chacune introduite par son titre suivi de deux points :

${SECTIONS_NOTE.map((s) => `${s} :`).join("\n")}

Règles, par ordre d'importance :

1. N'INVENTE RIEN. Tu n'écris que ce qui est dit dans la matière reçue. Jamais un budget déduit, une ville supposée, une date reconstituée, ni une intention prêtée.
2. Quand une section n'a pas de matière, écris « non précisé » et passe à la suivante. Un trou assumé vaut mieux qu'une phrase plausible et fausse.
3. Garde les mots de la personne quand ils sont précis : « vue mer », « pas avant septembre », « 800 000 maximum ». Ne les remplace pas par du vocabulaire plus vague.
4. Sois bref. Une à trois phrases par section, ou une courte liste. On relit cette note avant de décrocher, pas pour se documenter.
5. « Prochaine étape » dit une action et, si elle est connue, une échéance. S'il n'y en a pas, écris « non précisé » — ne propose pas d'action de ton cru.
6. Écris en français, au présent, sans tutoyer ni vouvoyer personne : c'est une note interne, pas un message.`;

/**
 * Un rappel court, posé juste avant la matière brute.
 *
 * Il répète le seul interdit qui compte vraiment. Une consigne noyée en tête
 * d'un long transcript se dilue ; celle-ci est à dix lignes de la fin.
 */
export const RAPPEL_FIDELITE =
  "Rappel : n'écris que ce qui figure ci-dessus. Toute section sans matière reçoit « non précisé ».";

/** La matière brute, bornée. Au-delà, ce n'est plus un appel, c'est un livre. */
export const LONGUEUR_MAX_MATIERE = 20_000;

/**
 * Prépare la matière avant envoi : coupe ce qui dépasse, refuse le vide.
 *
 * Couper plutôt que refuser un long transcript : une réunion d'une heure
 * dépasse la borne, et rendre une erreur à quelqu'un qui vient de coller son
 * transcript serait le pire moment pour être pointilleux. On prévient.
 */
export function prepareMatiere(brut: string): {
  texte: string;
  tronquee: boolean;
} | null {
  const net = brut.trim();
  if (net.length === 0) return null;
  if (net.length <= LONGUEUR_MAX_MATIERE) return { texte: net, tronquee: false };
  return { texte: net.slice(0, LONGUEUR_MAX_MATIERE), tronquee: true };
}
