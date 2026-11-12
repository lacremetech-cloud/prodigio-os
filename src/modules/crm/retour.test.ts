import { describe, expect, it } from "vitest";
import { chaineDeRetour, lienDeRetour } from "./retour";
import { lireFiltrePipeline } from "./pipeline-filtre";

/**
 * Le défaut que ces tests verrouillent : on filtre une liste, on ouvre une
 * fiche, on revient — et la liste est repartie de zéro.
 */
describe("le retour vers une liste", () => {
  it("recopie l'état de la liste", () => {
    expect(chaineDeRetour({ filter: "en_retard", sort: "priorite", page: "3" })).toBe(
      "?filter=en_retard&sort=priorite&page=3",
    );
  });

  it("écarte les valeurs vides, qui ne filtrent rien et allongent l'adresse", () => {
    expect(chaineDeRetour({ q: "", statut: "actif", responsable: "   " })).toBe("?statut=actif");
  });

  it("ne rend aucune chaîne quand la liste n'était pas filtrée", () => {
    expect(chaineDeRetour({})).toBe("");
    expect(lienDeRetour("/crm/mandats", {})).toBe("/crm/mandats");
  });

  it("n'emporte pas l'identifiant de la fiche : il ne décrit pas un écran de liste", () => {
    expect(chaineDeRetour({ id: "opp-42", filter: "nouveau" })).toBe("?filter=nouveau");
  });

  it("retient le premier terme d'un paramètre répété plutôt que d'échouer", () => {
    expect(chaineDeRetour({ sort: ["recent", "ancien"] })).toBe("?sort=recent");
  });

  it("recopie un paramètre qu'elle ne connaît pas", () => {
    /* On recopie TOUT : ajouter un filtre à une liste ne doit pas obliger à
       penser, des mois plus tard, à l'ajouter ici. */
    expect(chaineDeRetour({ filtre_invente_demain: "oui" })).toBe("?filtre_invente_demain=oui");
  });

  it("échappe ce qui doit l'être : une recherche contient des espaces et des accents", () => {
    const lien = lienDeRetour("/crm/biens", { q: "villa été" });
    expect(lien.startsWith("/crm/biens?q=")).toBe(true);
    expect(new URL(lien, "https://exemple.test").searchParams.get("q")).toBe("villa été");
  });
});

describe("le filtre du pipeline Mandats", () => {
  it("se relit tel quel", () => {
    expect(lireFiltrePipeline("en_retard")).toBe("en_retard");
    expect(lireFiltrePipeline(["fort_potentiel"])).toBe("fort_potentiel");
  });

  it("ne filtre rien devant une valeur inconnue, au lieu de vider le tableau", () => {
    expect(lireFiltrePipeline("inventé")).toBe("tous");
    expect(lireFiltrePipeline(undefined)).toBe("tous");
  });
});
