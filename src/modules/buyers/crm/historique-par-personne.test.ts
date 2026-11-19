import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou STRUCTUREL : la liste des acquéreurs lit l'historique PAR PERSONNE.
 *
 * Le 19 novembre, une seule carte du pipeline sur 461 affichait une note.
 * `loadBuyerList` lisait `crm_buyer_interest_activity`, qui groupe par
 * manifestation d'intérêt et écarte d'emblée toute activité sans
 * `interest_id`. Or les écrans de saisie consignent l'échange sur la PERSONNE :
 * 269 des 280 notes et 92 des 103 appels étaient donc invisibles, et le vivier
 * — celui qu'un commercial dépouille pour savoir quoi proposer à qui —
 * s'affichait entièrement muet.
 *
 * Le défaut était silencieux : aucune erreur, aucun écran cassé, juste des
 * cartes vides qui se lisaient comme « cette personne n'a jamais été appelée ».
 * C'est précisément le genre de panne qu'un test de rendu ne voit pas, parce
 * que le composant faisait son travail — on lui donnait du vide.
 *
 * Ce test ne juge pas le rendu. Il verrouille la SOURCE.
 */

const QUERIES = join(process.cwd(), "src", "modules", "buyers", "crm", "queries.ts");

/** Code seul, commentaires retirés : la vue est citée dans les deux. */
function code(fichier: string): string {
  return readFileSync(fichier, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("l'historique affiché sur une ligne d'acquéreur", () => {
  it("s'agrège par personne", () => {
    expect(code(QUERIES)).toContain("crm_buyer_profile_activity");
  });

  it("ne repasse pas par la vue groupée par manifestation", () => {
    /* Y revenir reviendrait à vider le vivier sans que rien ne casse. Si un
       besoin par projet réapparaît un jour, il s'ajoute à côté — il ne
       remplace pas celui-ci. */
    expect(code(QUERIES)).not.toContain("crm_buyer_interest_activity");
  });

  it("traduit l'auteur de la note en nom lisible", () => {
    /* La base stocke `author_user_id`. La carte a affiché
       « 0fdbfaa5-8f7b-4711-… » à côté de la date pendant trois jours. */
    expect(code(QUERIES)).toContain("memberDisplayName(activite.last_note_by");
  });
});
