import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde-fou STRUCTUREL : le pipeline n'envoie pas la base au navigateur.
 *
 * Jusqu'au 24 novembre 2026, la page du pipeline passait au tableau DEUX fois
 * les mêmes dossiers : les cartes, et `rows` — les 506 `BuyerInboxRow`
 * complets, « puisqu'ils étaient déjà chargés ». Mesuré ce jour-là :
 * ~1,6 Mo de JSON vers le navigateur à chaque ouverture de l'écran, soit
 * 3,4 ko par ligne, pour qu'on en lise UNE.
 *
 * Ce n'était pas une faille — la RLS filtre, les coordonnées sont masquées
 * AVANT l'envoi — mais c'étaient 281 personnes déposées dans un navigateur
 * pour en ouvrir une : ni minimal au sens du RGPD, ni journalisable. Rien ne
 * distinguait « il a consulté un dossier » de « il les a tous aspirés ».
 *
 * Le défaut était invisible : aucune erreur, aucun écran cassé, juste un
 * tableau qui rame et une charge utile que personne ne regarde. C'est
 * exactement ce qu'un test de rendu ne voit pas.
 */

const RACINE = process.cwd();
const PAGE = join(RACINE, "src", "app", "crm", "acquereurs", "pipeline", "page.tsx");
const TABLEAU = join(RACINE, "src", "components", "crm", "buyers", "buyer-kanban.tsx");

/** Code seul, commentaires retirés : ils parlent tous de `rows`. */
function code(fichier: string): string {
  return readFileSync(fichier, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("ce que le pipeline envoie au navigateur", () => {
  it("ne passe plus les dossiers complets au tableau", () => {
    /* On vise le bloc `<BuyerKanbanBoard ... />` et lui seul : `BandeauFile`
       reçoit `rows` lui aussi, mais c'est un composant SERVEUR — il compte
       des dossiers et n'en rend que des nombres. Rien ne traverse. */
    const src = code(PAGE);
    const debut = src.indexOf("<BuyerKanbanBoard");
    expect(debut, "le tableau n'est plus monté par cette page ?").toBeGreaterThan(-1);
    const bloc = src.slice(debut, src.indexOf("/>", debut));
    expect(bloc).not.toMatch(/rows=\{/);
  });

  it("le tableau n'accepte plus de les recevoir", () => {
    /* La prop supprimée, pas seulement inutilisée : tant qu'elle existe, une
       page peut la repasser sans que rien ne proteste. */
    expect(code(TABLEAU)).not.toMatch(/rows\?:\s*BuyerInboxRow\[\]/);
  });

  it("le panneau demande SON dossier à l'ouverture", () => {
    expect(code(TABLEAU)).toContain("chargerDossierAction");
  });

  it("la carte ne dessine pas la colonne entière", () => {
    /* « À contacter » compte 264 dossiers. Les dessiner tous, chacun avec ses
       boutons, faisait ~19 000 nœuds pour un écran dont on lit les premières
       cartes. Le compteur de l'en-tête, lui, annonce toujours le total. */
    expect(code(TABLEAU)).toContain("PLAFOND_COLONNE");
  });

  it("un seul menu de déplacement pour tout le tableau", () => {
    /* 460 <select> de neuf options chacun : ~4 000 nœuds pour un geste qu'on
       fait rarement — le déplacement courant se fait au glisser-déposer. */
    expect(code(TABLEAU)).not.toMatch(/<select/);
  });
});
