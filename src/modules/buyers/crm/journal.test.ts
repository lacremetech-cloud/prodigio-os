import { describe, expect, it } from "vitest";
import { changementsLisibles } from "./journal";

describe("ce que raconte l'historique", () => {
  it("dit l'étape AVANT et APRÈS, en toutes lettres", () => {
    expect(
      changementsLisibles({ stage: "a_rappeler" }, { stage: "en_discussion" }),
    ).toEqual(["étape : À rappeler → En discussion"]);
  });

  it("traduit les valeurs disparues plutôt que de livrer un identifiant", () => {
    // Six mois d'historique contiennent « en_reflexion » et « nouveau ».
    const r = changementsLisibles(
      { qualification: "en_reflexion" },
      { qualification: "gros_potentiel" },
    );
    expect(r[0]).toBe("qualification : Qualifié → Gros potentiel");
    expect(r[0]).not.toMatch(/en_reflexion/);
  });

  it("ne dit rien d'un champ qui n'a pas bougé", () => {
    expect(
      changementsLisibles(
        { stage: "en_discussion", qualification: "qualifie" },
        { stage: "en_discussion", qualification: "qualifie" },
      ),
    ).toEqual([]);
  });

  it("annonce les deux changements quand les deux ont bougé", () => {
    expect(
      changementsLisibles(
        { stage: "a_contacter", qualification: "a_qualifier" },
        { stage: "pas_interesse", qualification: "qualifie" },
      ),
    ).toEqual([
      "étape : À contacter → Pas intéressé",
      "qualification : À qualifier → Qualifié",
    ]);
  });

  it("ne reste pas muet quand seule une activité a été consignée", () => {
    expect(changementsLisibles({}, { activite: "appel_echange" })).toEqual([
      "activité consignée",
    ]);
  });

  it("ne répète pas l'activité quand une étape a changé : le fil la raconte déjà", () => {
    expect(
      changementsLisibles({ stage: "a_contacter" }, { stage: "a_rappeler", activite: "message_vocal" }),
    ).toEqual(["étape : À contacter → À rappeler"]);
  });
});
