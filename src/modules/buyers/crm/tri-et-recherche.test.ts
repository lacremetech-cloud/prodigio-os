import { describe, expect, it } from "vitest";
import { ecrireNavigation, lireRecherche, lireTri, TRI_PAR_DEFAUT } from "./navigation";

/**
 * Le tri et la recherche doivent voyager comme les filtres.
 *
 * Le défaut d'origine : on triait la liste par date d'arrivée, on ouvrait un
 * dossier, on revenait — et la liste était retriée par urgence sans que rien à
 * l'écran ne le signale. Plus sournois qu'un filtre perdu : un filtre perdu se
 * voit, la liste s'allonge ; un tri perdu ne se voit pas.
 */
describe("l'ordre de la liste dans l'adresse", () => {
  it("se relit tel qu'il a été écrit", () => {
    const chaine = ecrireNavigation({ projets: [], vue: "liste", tri: "arrivee_ancienne" });
    expect(chaine).toBe("?tri=arrivee_ancienne");
    expect(lireTri(new URLSearchParams(chaine.slice(1)).get("tri") ?? undefined)).toBe(
      "arrivee_ancienne",
    );
  });

  it("n'écrit pas l'ordre par défaut : les adresses restent courtes", () => {
    expect(ecrireNavigation({ projets: [], vue: "liste", tri: TRI_PAR_DEFAUT })).toBe("");
  });

  it("rend l'ordre par défaut devant une valeur inconnue", () => {
    /* Un lien copié d'une version plus ancienne du CRM doit continuer d'ouvrir
       un écran utilisable, pas une liste vide ni une exception. */
    expect(lireTri("par_couleur_de_cravate")).toBe(TRI_PAR_DEFAUT);
    expect(lireTri(undefined)).toBe(TRI_PAR_DEFAUT);
  });

  it("voyage avec les filtres, sans les chasser", () => {
    const chaine = ecrireNavigation({
      projets: ["p-1"],
      vue: "liste",
      budget: "plus_1m",
      qualification: "a_qualifier",
      stage: "a_rappeler",
      responsable: "u-9",
      tri: "activite",
      recherche: "dupont",
    });
    const q = new URLSearchParams(chaine.slice(1));
    expect(q.get("projets")).toBe("p-1");
    expect(q.get("budget")).toBe("plus_1m");
    expect(q.get("qualification")).toBe("a_qualifier");
    expect(q.get("stage")).toBe("a_rappeler");
    expect(q.get("responsable")).toBe("u-9");
    expect(q.get("tri")).toBe("activite");
    expect(q.get("q")).toBe("dupont");
  });
});

describe("la recherche dans l'adresse", () => {
  it("s'écrit sous `q`, débarrassée de ses espaces de bord", () => {
    expect(ecrireNavigation({ projets: [], vue: "liste", recherche: "  dupont  " })).toBe(
      "?q=dupont",
    );
  });

  it("ne laisse pas de `?q=` vide quand on n'a rien cherché", () => {
    expect(ecrireNavigation({ projets: [], vue: "liste", recherche: "   " })).toBe("");
    expect(ecrireNavigation({ projets: [], vue: "liste" })).toBe("");
  });

  it("borne ce qu'elle relit : une adresse n'est pas un champ de saisie", () => {
    expect(lireRecherche("x".repeat(500))).toHaveLength(120);
    expect(lireRecherche(undefined)).toBe("");
  });

  it("survit aux accents et aux espaces", () => {
    const chaine = ecrireNavigation({ projets: [], vue: "liste", recherche: "villa été" });
    expect(lireRecherche(new URLSearchParams(chaine.slice(1)).get("q") ?? undefined)).toBe(
      "villa été",
    );
  });
});
