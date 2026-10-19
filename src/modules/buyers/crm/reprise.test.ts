import { describe, expect, it } from "vitest";
import { etatFigePertinent } from "./reprise";

/**
 * LA FICHE INVENTAIT UN HISTORIQUE.
 *
 * La ligne « Avant la reprise du 14 octobre 2026, ce projet portait : … »
 * s'affichait sans AUCUNE condition. Une demande déposée le 19 octobre
 * annonçait un passé antérieur de cinq jours à sa propre naissance, en
 * récitant la valeur par défaut de la colonne.
 */

const COURANT = { pipeline_stage: "a_rappeler", qualification: "qualifie" };
const avant = "2026-10-14T05:30:00Z"; // avant la reprise (19 h UTC)
const apres = "2026-10-19T09:00:00Z"; // cinq jours apres

describe("état figé d'avant la reprise", () => {
  it("se tait pour une demande POSTÉRIEURE à la reprise", () => {
    // Le cas du bug : un dépôt du 19 octobre n'a pas d'« avant ».
    expect(
      etatFigePertinent(
        { pipeline_stage: "a_contacter", qualification: "a_qualifier", created_at: apres },
        COURANT,
      ),
    ).toBeNull();
  });

  it("parle pour une demande ANTÉRIEURE dont l'état a changé depuis", () => {
    expect(
      etatFigePertinent(
        { pipeline_stage: "a_contacter", qualification: "a_qualifier", created_at: avant },
        COURANT,
      ),
    ).toBe("À contacter · À qualifier");
  });

  it("se tait quand l'état figé est IDENTIQUE à l'état courant", () => {
    // Répéter au passé ce que l'en-tête affiche au présent n'apprend rien.
    expect(etatFigePertinent({ ...COURANT, created_at: avant }, COURANT)).toBeNull();
  });

  it("parle si SEULE la qualification a changé", () => {
    expect(
      etatFigePertinent(
        { pipeline_stage: "a_rappeler", qualification: "a_qualifier", created_at: avant },
        COURANT,
      ),
    ).not.toBeNull();
  });

  it("se tait À LA SECONDE de la reprise, pas avant", () => {
    expect(
      etatFigePertinent(
        { pipeline_stage: "a_contacter", qualification: "a_qualifier", created_at: "2026-10-14T19:00:00Z" },
        COURANT,
      ),
    ).toBeNull();
    expect(
      etatFigePertinent(
        { pipeline_stage: "a_contacter", qualification: "a_qualifier", created_at: "2026-10-14T18:59:59Z" },
        COURANT,
      ),
    ).not.toBeNull();
  });

  it("se tait plutôt que de lever sur une date illisible", () => {
    expect(
      etatFigePertinent(
        { pipeline_stage: "a_contacter", qualification: "a_qualifier", created_at: "pas une date" },
        COURANT,
      ),
    ).toBeNull();
  });

  it("traduit les valeurs DISPARUES au lieu de livrer un identifiant technique", () => {
    const t = etatFigePertinent(
      { pipeline_stage: "a_contacter", qualification: "en_reflexion", created_at: avant },
      COURANT,
    );
    expect(t).not.toBeNull();
    expect(t).not.toContain("en_reflexion");
  });
});
