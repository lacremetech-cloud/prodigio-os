import { describe, expect, it } from "vitest";
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
