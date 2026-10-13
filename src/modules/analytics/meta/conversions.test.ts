import { describe, expect, it } from "vitest";
import { donneesDuBien } from "./conversions";

/**
 * Le bien envoyé à Meta. C'est lui qui permet de ventiler les conversions par
 * bien dans le Gestionnaire de publicités, sans dépendre du nom donné aux
 * campagnes.
 */
describe("donneesDuBien", () => {
  it("envoie le nom ET l’identifiant du bien", () => {
    // L'identifiant accompagne le libellé : un nom commercial peut changer en
    // cours de campagne, pas lui — sinon la série se coupe en deux.
    expect(donneesDuBien("Villa Verdun", "prop-1")).toEqual({
      content_name: "Villa Verdun",
      content_ids: ["prop-1"],
      content_category: "bien_immobilier",
    });
  });

  it("se contente de l’identifiant quand le bien n’a pas de nom", () => {
    expect(donneesDuBien(null, "prop-1")).toEqual({
      content_ids: ["prop-1"],
      content_category: "bien_immobilier",
    });
  });

  it("n’envoie rien plutôt qu’un bloc vide", () => {
    // Meta refuse les champs vides, et un `custom_data` sans contenu n'apprend
    // rien : mieux vaut l'omettre.
    expect(donneesDuBien(null, null)).toBeUndefined();
    expect(donneesDuBien("", "")).toBeUndefined();
  });
});
