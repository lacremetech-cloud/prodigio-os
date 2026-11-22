import { describe, expect, it } from "vitest";
import { detailDeLaPanne, EcritureImpossible } from "./erreurs";
import { LectureImpossible, TAILLE_DE_PAGE, toutLire } from "./lecture-complete";

/**
 * PostgREST tronque une réponse à 1 000 lignes sans erreur : un total calculé
 * sur la première page serait faux sans le dire. `toutLire` va jusqu'au bout.
 */
describe("lire jusqu'au bout", () => {
  it("enchaîne les pages jusqu'à une page incomplète", async () => {
    const total = TAILLE_DE_PAGE * 2 + 7;
    const demandes: [number, number][] = [];
    const lignes = await toutLire<number>(async (debut, fin) => {
      demandes.push([debut, fin]);
      const page = [];
      for (let i = debut; i <= Math.min(fin, total - 1); i += 1) page.push(i);
      return { data: page, error: null };
    });
    expect(lignes).toHaveLength(total);
    expect(lignes.at(-1)).toBe(total - 1);
    expect(demandes).toEqual([
      [0, TAILLE_DE_PAGE - 1],
      [TAILLE_DE_PAGE, 2 * TAILLE_DE_PAGE - 1],
      [2 * TAILLE_DE_PAGE, 3 * TAILLE_DE_PAGE - 1],
    ]);
  });

  it("une page pleine exactement appelle une page de plus, vide", async () => {
    let appels = 0;
    const lignes = await toutLire<number>(async (debut) => {
      appels += 1;
      return { data: debut === 0 ? Array.from({ length: TAILLE_DE_PAGE }, (_, i) => i) : [], error: null };
    });
    expect(lignes).toHaveLength(TAILLE_DE_PAGE);
    expect(appels).toBe(2);
  });

  it("une erreur de la base n'est jamais prise pour une liste vide", async () => {
    const erreur = await toutLire(async () => ({ data: null, error: { code: "42P01" } })).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(LectureImpossible);
    expect((erreur as LectureImpossible).code).toBe("42P01");
  });
});

describe("les pannes de la base ont un nom, une étape et un code", () => {
  it("une lecture nommée porte son étape", async () => {
    const erreur = await toutLire(async () => ({ data: null, error: { code: "PGRST205" } }), "règles").catch((e: unknown) => e);
    expect(erreur).toMatchObject({ name: "LectureImpossible", etape: "règles", code: "PGRST205" });
  });

  it("le journal en tire le genre, l'étape et le code — jamais un texte venu de la base", () => {
    const ecriture = new EcritureImpossible("couverture", "21000");
    expect(ecriture.name).toBe("EcritureImpossible");
    expect(detailDeLaPanne(ecriture)).toEqual({ erreur: "EcritureImpossible", etape: "couverture", code: "21000" });
    expect(detailDeLaPanne(new LectureImpossible(undefined))).toEqual({ erreur: "LectureImpossible", etape: null, code: null });
    expect(detailDeLaPanne(new RangeError("x"))).toEqual({ erreur: "RangeError", etape: null, code: null });
    expect(detailDeLaPanne("bizarre")).toEqual({ erreur: "inconnue", etape: null, code: null });
  });
});
