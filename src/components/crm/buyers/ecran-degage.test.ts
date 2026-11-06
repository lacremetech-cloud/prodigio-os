import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * CE QUI A ÉTÉ RETIRÉ DE LA BOÎTE DE RÉCEPTION, ET POURQUOI ÇA NE REVIENT PAS.
 *
 * Signalé le 6 novembre en regardant l'écran d'Édouard, tout neuf et donc
 * sans rien pour masquer le décor : « tu trouves pas qu'il y a des choses qui
 * servent à rien ? ».
 *
 * Quatre éléments. Chacun pris séparément se défend ; ensemble ils repoussaient
 * le premier nom hors de l'écran. Ce fichier retient la décision, parce qu'un
 * élément supprimé revient toujours — par une bonne intention, et sans que
 * personne se souvienne qu'on l'avait enlevé.
 */

const inbox = readFileSync("src/components/crm/buyers/buyer-inbox.tsx", "utf8");
const bandeau = readFileSync("src/components/crm/buyers/bandeau-file.tsx", "utf8");
const barre = readFileSync("src/components/crm/buyers/barre-projets.tsx", "utf8");
const css = readFileSync("src/app/crm/crm.css", "utf8");
const page = readFileSync("src/app/crm/acquereurs/page.tsx", "utf8");

describe("1. les compteurs ne doublent plus les pastilles", () => {
  it("la rangée de compteurs a disparu", () => {
    // « DOSSIERS / À CONTACTER / EN RETARD / SANS ACTION » en gros, puis les
    // mêmes en pastilles trente pixels plus bas.
    expect(inbox).not.toContain("crm-compteurs-file");
    expect(inbox).not.toMatch(/<Counter\b/);
  });

  it("le composant Counter ne reste pas en code mort", () => {
    expect(inbox).not.toMatch(/function Counter\b/);
  });

  it("les pastilles, elles, sont toujours là — ce sont elles qui filtrent", () => {
    expect(inbox).toContain("FILTRES_RAPIDES");
    expect(inbox).toContain("porteLeSignal");
  });
});

describe("2. le bandeau ne parle que s'il a quelque chose à dire", () => {
  it("rien à annoncer, rien d'affiché", () => {
    /* Sa raison d'être est l'ÉCART : « 16 dossiers » quand deux sont écartés.
       Sans écart il redit le total que la pastille « Tous » porte déjà. */
    expect(bandeau).toContain("if (nonQualifies === 0 && sorties === 0) return null;");
  });

  it("mais il parle dès qu'il y a un écart", () => {
    expect(bandeau).toContain("non qualifiée");
    expect(bandeau).toContain("sortie");
  });
});

describe("3. on ne fait pas choisir là où il n'y a pas de choix", () => {
  it("un seul bien : pas de barre de projets", () => {
    expect(barre).toContain("const choixDeProjet = projets.length > 1;");
  });

  it("mais la bascule Liste / Pipeline reste, elle ne dépend pas du nombre de biens", () => {
    const apres = barre.slice(barre.indexOf("choixDeProjet"));
    expect(apres).toContain("crm-vues");
    expect(apres).toContain("Pipeline");
  });

  it("un seul responsable À L'ÉCRAN : pas de sélecteur de responsable", () => {
    /*
     * LE PREMIER JET ÉTAIT FAUX, et il n'aurait rien changé pour Édouard.
     * Il testait `members.length`, qui compte les collaborateurs AFFECTABLES
     * de toute l'organisation — cinq, Édouard compris. Le critère utile est
     * le nombre de responsables distincts réellement présents dans les lignes
     * visibles : à un seul, le filtre ne peut rendre que tout ou rien.
     */
    expect(inbox).toContain("responsablesDistincts > 1 ?");
    expect(inbox).not.toContain("members.length > 1");
    // Le calcul porte sur les LIGNES, pas sur l'annuaire.
    const i = inbox.indexOf("const responsablesDistincts");
    expect(i).toBeGreaterThan(-1);
    const calcul = inbox.slice(i, i + 400);
    expect(calcul).toContain("for (const r of rows)");
    expect(calcul).toContain('cases.add("aucun")');
    expect(calcul).toContain("assigneeIds");
  });
});

describe("4. le replieur de filtres est bien réservé au téléphone", () => {
  it("la règle est posée dans crm.css, hors de portée de l'ordre de chargement", () => {
    /*
     * LE DÉFAUT EXACT. Le composant porte `sm:hidden`. Les deux règles ont la
     * même spécificité (0,1,0), et `crm.css` est importée par la mise en page
     * du CRM, donc APRÈS les utilitaires Tailwind de la mise en page racine :
     * à égalité, la dernière déclarée gagne — c'était `.crm-replier`. Le
     * bouton s'affichait donc sur ordinateur, où il ne fait rien.
     */
    const i = css.indexOf(".crm-replier {");
    expect(i).toBeGreaterThan(-1);
    const regle = css.slice(i, css.indexOf(".crm-replier__pastille"));
    expect(regle).toContain("@media (min-width: 640px)");
    expect(regle.slice(regle.indexOf("@media"))).toContain("display: none");
  });

  it("le composant garde sa classe utilitaire : les deux disent la même chose", () => {
    expect(inbox).toContain('className="crm-replier sm:hidden"');
  });
});

describe("5. le sous-titre explicatif ne revient pas", () => {
  it("la règle « une ligne par personne » ne se relit plus tous les jours", () => {
    expect(page).not.toContain("Une ligne par personne");
  });
});
