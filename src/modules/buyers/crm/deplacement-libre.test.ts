import { describe, expect, it } from "vitest";
import {
  ETAPES_ACCEPTEES_EN_ECRITURE,
  ETAPES_ACQUEREUR,
  ETAPES_RETIREES,
  etape,
} from "./vocabulaire";
import { BUYER_KANBAN_COLUMNS } from "./labels";
import { evaluateBuyerMove, PROTECTED_BUYER_STAGES, CLOSED_BUYER_STAGES } from "./pipeline";

/**
 * QUATRE COLONNES SUR SEPT REFUSAIENT LE DÉPÔT.
 *
 * Le serveur gardait sa propre liste d'étapes, figée au vocabulaire d'avant la
 * reprise du 14 octobre : « a_contacter », « visite_planifiee »,
 * « pas_interesse » et « mauvais_numero » n'y figuraient pas. Glisser une
 * carte vers l'une d'elles répondait « utilisez l'action dédiée (offre ou
 * résultat) » — une action supprimée depuis, puisque plus aucune étape n'est
 * réservée.
 *
 * Le commercial lisait donc un refus sans raison, et en concluait que l'outil
 * était fait comme ça. Un client l'a filmé pour le signaler.
 *
 * Ces tests tiennent l'invariant qui manquait : TOUTE colonne affichée doit
 * être déposable.
 */
describe("déplacement sans contrainte", () => {
  it("accepte en écriture CHAQUE colonne affichée dans le pipeline", () => {
    for (const colonne of BUYER_KANBAN_COLUMNS) {
      expect(
        (ETAPES_ACCEPTEES_EN_ECRITURE as readonly string[]).includes(colonne),
        `la colonne « ${colonne} » est affichée mais refusée en écriture`,
      ).toBe(true);
    }
  });

  it("couvre les sept étapes, pas une de moins", () => {
    for (const e of ETAPES_ACQUEREUR) {
      expect(ETAPES_ACCEPTEES_EN_ECRITURE as readonly string[]).toContain(e);
    }
  });

  it("tolère encore les anciens noms, pour les onglets restés ouverts", () => {
    // La base les traduit (`crm_etape_v2`) : personne ne perd sa saisie.
    for (const ancien of Object.keys(ETAPES_RETIREES)) {
      expect(ETAPES_ACCEPTEES_EN_ECRITURE as readonly string[]).toContain(ancien);
    }
  });

  it("n'a plus AUCUNE étape réservée ni terminale", () => {
    expect(Object.keys(PROTECTED_BUYER_STAGES)).toEqual([]);
    expect(CLOSED_BUYER_STAGES).toEqual([]);
  });

  it("autorise tout déplacement d'une colonne vers une autre", () => {
    for (const depuis of BUYER_KANBAN_COLUMNS) {
      for (const vers of BUYER_KANBAN_COLUMNS) {
        if (depuis === vers) continue;
        const r = evaluateBuyerMove(depuis, vers);
        expect(r.allowed, `${depuis} → ${vers} refusé : ${r.reason ?? ""}`).toBe(true);
      }
    }
  });

  it("ne renvoie plus jamais vers une « action dédiée »", () => {
    // Le message désignait une action qui n'existe plus.
    for (const depuis of BUYER_KANBAN_COLUMNS) {
      for (const vers of BUYER_KANBAN_COLUMNS) {
        const r = evaluateBuyerMove(depuis, vers);
        expect(r.requiresAction).toBeUndefined();
        expect(r.reason ?? "").not.toContain("action dédiée");
      }
    }
  });
});

/**
 * LA CONVERSION « RENDEZ-VOUS PROGRAMMÉ » NE PARTAIT PLUS.
 *
 * Le test comparait la chaîne brute `"visite"`. L'étape s'appelle
 * `visite_planifiee` depuis la reprise : la comparaison échouait en silence —
 * elle ne lève pas, elle se tait — et Meta n'a plus reçu un seul rendez-vous
 * depuis le 14 octobre. Normaliser AVANT de comparer est ce qui le corrige.
 */
describe("normalisation avant comparaison", () => {
  it("rend « visite_planifiee » pour l'ancien nom comme pour le nouveau", () => {
    expect(etape("visite").valeur).toBe("visite_planifiee");
    expect(etape("visite_planifiee").valeur).toBe("visite_planifiee");
  });

  it("rend « en_discussion » pour les trois anciens noms qui s'y ramènent", () => {
    for (const ancien of ["offre", "gagne", "en_discussion"]) {
      expect(etape(ancien).valeur).toBe("en_discussion");
    }
  });

  it("ramène « perdu » sur « pas_interesse », et non sur une étape active", () => {
    expect(etape("perdu").valeur).toBe("pas_interesse");
  });
});
