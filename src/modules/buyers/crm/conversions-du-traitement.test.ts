import { describe, expect, it } from "vitest";
import { conversionsDuTraitement } from "./conversions-du-traitement";

/**
 * Le panneau « Enregistrer et suivant » déclenche les conversions Meta sur le
 * FAIT écrit en base : une entrée en discussion, une entrée en visite, une
 * visite inscrite à l'agenda. Jamais sur un dossier qui y était déjà.
 */
describe("les conversions d'un traitement", () => {
  it("entrer en discussion : « inscription terminée »", () => {
    expect(conversionsDuTraitement({ etapeAvant: "a_rappeler", etapeApres: "en_discussion", visiteInscrite: false })).toEqual([
      "inscription_terminee",
    ]);
  });

  it("y être déjà : rien (le dossier ne rentre pas une seconde fois)", () => {
    expect(conversionsDuTraitement({ etapeAvant: "en_discussion", etapeApres: "en_discussion", visiteInscrite: false })).toEqual([]);
  });

  it("entrer en visite planifiée : « rendez-vous programmé »", () => {
    expect(conversionsDuTraitement({ etapeAvant: "en_discussion", etapeApres: "visite_planifiee", visiteInscrite: false })).toEqual([
      "rendez_vous",
    ]);
  });

  it("une visite inscrite à l'agenda compte, même sans changement d'étape — une seule fois avec l'entrée en visite", () => {
    expect(conversionsDuTraitement({ etapeAvant: "visite_planifiee", etapeApres: "visite_planifiee", visiteInscrite: true })).toEqual([
      "rendez_vous",
    ]);
    expect(conversionsDuTraitement({ etapeAvant: "en_discussion", etapeApres: "visite_planifiee", visiteInscrite: true })).toEqual([
      "rendez_vous",
    ]);
  });

  it("une ancienne clé d'étape se lit dans le vocabulaire d'aujourd'hui", () => {
    // « visite » est l'ancienne clé de « visite planifiée » : y être déjà, c'est y être.
    expect(conversionsDuTraitement({ etapeAvant: "visite", etapeApres: "visite_planifiee", visiteInscrite: false })).toEqual([]);
  });

  it("une étape avant illisible : l'entrée compte (une conversion déjà partie ne repart pas)", () => {
    expect(conversionsDuTraitement({ etapeAvant: null, etapeApres: "en_discussion", visiteInscrite: false })).toEqual([
      "inscription_terminee",
    ]);
  });

  it("les autres étapes ne déclenchent rien", () => {
    for (const apres of ["a_rappeler", "r1_planifie", "offre_en_cours", "vivier", "pas_interesse", "mauvais_numero"]) {
      expect(conversionsDuTraitement({ etapeAvant: "a_contacter", etapeApres: apres, visiteInscrite: false }), apres).toEqual([]);
    }
  });
});
