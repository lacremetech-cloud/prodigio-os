import { describe, expect, it } from "vitest";
import {
  CONSIGNE_NOTE,
  LONGUEUR_MAX_MATIERE,
  SECTIONS_NOTE,
  prepareMatiere,
} from "./gabarit-note";

/**
 * « Structure l'IA en mode : c'est quoi les prochaines étapes ? Qu'elle nous
 * fasse le template type de ce qu'on attend comme retour. »
 *
 * Ces tests ne jugent pas la qualité d'un résumé — cela se juge en le lisant.
 * Ils verrouillent ce qui doit rester vrai quoi qu'il arrive à la consigne :
 * les quatre sections, et les interdits qui empêchent une note inventée.
 */
describe("le gabarit de note", () => {
  it("annonce les quatre sections au modèle, dans l'ordre", () => {
    let position = -1;
    for (const section of SECTIONS_NOTE) {
      const trouve = CONSIGNE_NOTE.indexOf(section);
      expect(trouve, `section absente de la consigne : ${section}`).toBeGreaterThan(-1);
      expect(trouve, `section dans le désordre : ${section}`).toBeGreaterThan(position);
      position = trouve;
    }
  });

  it("porte l'interdit d'inventer, qui est la règle numéro un", () => {
    /* Une note d'appel est relue des semaines plus tard par quelqu'un qui
       n'était pas là. Une phrase plausible et fausse y fait plus de dégâts
       qu'un trou assumé. */
    expect(CONSIGNE_NOTE).toContain("N'INVENTE RIEN");
    expect(CONSIGNE_NOTE).toContain("non précisé");
  });

  it("demande une note brève : on la relit avant de décrocher", () => {
    expect(CONSIGNE_NOTE.toLowerCase()).toContain("bref");
  });
});

describe("la matière envoyée au modèle", () => {
  it("refuse le vide plutôt que d'appeler l'API pour rien", () => {
    expect(prepareMatiere("")).toBeNull();
    expect(prepareMatiere("   \n  ")).toBeNull();
  });

  it("retire les espaces de bord sans toucher au reste", () => {
    expect(prepareMatiere("  Cherche un 3 pièces.  ")).toEqual({
      texte: "Cherche un 3 pièces.",
      tronquee: false,
    });
  });

  it("coupe un transcript trop long au lieu de le refuser", () => {
    /* Une réunion d'une heure dépasse la borne. Rendre une erreur à quelqu'un
       qui vient de coller son transcript serait le pire moment pour être
       pointilleux : on coupe, et on le dit. */
    const enorme = "a".repeat(LONGUEUR_MAX_MATIERE + 5_000);
    const prepare = prepareMatiere(enorme);
    expect(prepare?.tronquee).toBe(true);
    expect(prepare?.texte).toHaveLength(LONGUEUR_MAX_MATIERE);
  });

  it("ne signale pas de coupe quand le texte tient exactement dans la borne", () => {
    const pile = "a".repeat(LONGUEUR_MAX_MATIERE);
    expect(prepareMatiere(pile)).toEqual({ texte: pile, tronquee: false });
  });
});
