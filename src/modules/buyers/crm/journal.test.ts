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

  it("ne nomme pas un champ qui n'a pas bougé, mais ne reste pas muet", () => {
    /* Vu en production sur la fiche de Lionel : trois lignes « Suivi
       enregistré · 12:02 · Antoine » et rien d'autre, parce que la sauvegarde
       n'avait bouge ni l'etape ni la qualification — une note seule. Une ligne
       muette fait chercher un changement qui n'existe pas. On le dit, sans
       nommer les champs inchanges. */
    const r = changementsLisibles(
      { stage: "en_discussion", qualification: "qualifie" },
      { stage: "en_discussion", qualification: "qualifie" },
    );
    expect(r).toEqual(["saisie enregistrée, sans changement d'étape ni de qualification"]);
    expect(r[0]).not.toMatch(/discussion|Qualifié/);
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
      "échange téléphonique consignée",
    ]);
  });

  it("ne répète pas l'activité quand une étape a changé : le fil la raconte déjà", () => {
    expect(
      changementsLisibles({ stage: "a_contacter" }, { stage: "a_rappeler", activite: "message_vocal" }),
    ).toEqual(["étape : À contacter → À rappeler"]);
  });
  /* La régression trouvée en production sur la fiche de Lionel : les lignes
     écrites AVANT la reprise portent `resultat_appel`, pas `activite`. Ne lire
     que la clé actuelle les laissait muettes — « Traitement enregistré, 14:29,
     Antoine » et rien d'autre, précisément ce qu'on voulait corriger. */
  it("lit aussi l'ancienne clé resultat_appel", () => {
    expect(
      changementsLisibles(
        { stage: "a_rappeler", qualification: "qualifie" },
        { stage: "a_rappeler", qualification: "qualifie", resultat_appel: "sans_reponse" },
      ),
    ).toEqual(["appel sans réponse consignée"]);
  });

  it("n'affiche jamais un identifiant technique, quel que soit le vocabulaire", () => {
    const lignes = [
      ...changementsLisibles({}, { stage: "visite_planifiee" }),
      ...changementsLisibles({}, { qualification: "non_qualifie" }),
      ...changementsLisibles({}, { resultat_appel: "message_laisse" }),
      ...changementsLisibles({}, { resultat_appel: "mauvais_numero" }),
    ];
    expect(lignes.length).toBeGreaterThan(3);
    for (const l of lignes) expect(l).not.toMatch(/_/);
  });
});
