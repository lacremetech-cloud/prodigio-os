import { describe, expect, it } from "vitest";
import {
  correspondALaRecherche,
  filtrer,
  FILTRES_AVANCES_VIDES,
  lireEcheance,
  lireSignal,
  nombreDeFiltresAvances,
  passeLesFiltresAvances,
  porteLeSignal,
  type DossierFiltrable,
} from "./filtres";

const MAINTENANT = new Date("2026-10-14T14:00:00.000Z").getTime();

function dossier(p: Partial<DossierFiltrable> = {}): DossierFiltrable {
  return {
    name: "Camille Durand",
    emailMasked: "c@example.test",
    phoneMasked: "+33612345678",
    city: "Cassis",
    propertyLabel: "Villa Verdun",
    stage: "nouveau",
    qualification: "a_qualifier",
    callAttempts: 0,
    nextActionAt: null,
    assigneeIds: [],
    budgetMinCents: null,
    budgetMaxCents: null,
    ...p,
  };
}

const ETAT = {
  signal: "tous" as const,
  echeance: "toutes" as const,
  recherche: "",
  avances: FILTRES_AVANCES_VIDES,
};

describe("les trois filtres rapides", () => {
  it("« Tous » ne retire rien", () => {
    expect(porteLeSignal(dossier({ callAttempts: 9 }), "tous", "toutes", MAINTENANT)).toBe(true);
  });

  /* Le piège : un dossier appelé trois fois sans succès n'est PAS à contacter,
     il est à rappeler. Les confondre remet en tête de file des gens qu'on
     vient d'essayer de joindre. */
  it("« À contacter » ne garde que ceux à qui personne n'a parlé", () => {
    expect(porteLeSignal(dossier({ callAttempts: 0 }), "a_contacter", "toutes", MAINTENANT)).toBe(true);
    expect(porteLeSignal(dossier({ callAttempts: 3 }), "a_contacter", "toutes", MAINTENANT)).toBe(false);
  });

  it("« À rappeler » exige un rappel ouvert", () => {
    expect(porteLeSignal(dossier({ nextActionAt: null }), "a_rappeler", "toutes", MAINTENANT)).toBe(false);
    expect(
      porteLeSignal(dossier({ nextActionAt: "2026-10-20T10:00:00.000Z" }), "a_rappeler", "toutes", MAINTENANT),
    ).toBe(true);
  });
});

describe("l'échéance affine « À rappeler »", () => {
  const hier = dossier({ nextActionAt: "2026-10-13T10:00:00.000Z" });
  const ceMatin = dossier({ nextActionAt: "2026-10-14T09:00:00.000Z" });
  const ceSoir = dossier({ nextActionAt: "2026-10-14T18:00:00.000Z" });
  const demain = dossier({ nextActionAt: "2026-10-15T09:00:00.000Z" });

  it("sépare en retard, aujourd'hui et à venir", () => {
    expect(porteLeSignal(hier, "a_rappeler", "en_retard", MAINTENANT)).toBe(true);
    expect(porteLeSignal(ceMatin, "a_rappeler", "en_retard", MAINTENANT)).toBe(false);
    expect(porteLeSignal(ceMatin, "a_rappeler", "aujourdhui", MAINTENANT)).toBe(true);
    expect(porteLeSignal(ceSoir, "a_rappeler", "aujourdhui", MAINTENANT)).toBe(true);
    expect(porteLeSignal(demain, "a_rappeler", "a_venir", MAINTENANT)).toBe(true);
  });

  /* « Dus » est la tuile du tableau de bord : elle se lit à l'heure, pas au
     jour. Un rappel pris pour 18 h n'est pas dû à 14 h, même s'il est bien
     « aujourd'hui ». Le compteur et la liste qu'il ouvre doivent compter la
     même chose. */
  it("« Rappels dus » compte les échéances atteintes ou dépassées", () => {
    expect(porteLeSignal(hier, "a_rappeler", "dus", MAINTENANT)).toBe(true);
    expect(porteLeSignal(ceMatin, "a_rappeler", "dus", MAINTENANT)).toBe(true);
    expect(porteLeSignal(ceSoir, "a_rappeler", "dus", MAINTENANT)).toBe(false);
    expect(porteLeSignal(demain, "a_rappeler", "dus", MAINTENANT)).toBe(false);
  });

  it("l'échéance n'a aucun effet hors de « À rappeler »", () => {
    expect(porteLeSignal(dossier({ callAttempts: 0 }), "a_contacter", "dus", MAINTENANT)).toBe(true);
  });
});

describe("les quatre filtres repliés", () => {
  it("la qualification", () => {
    const d = dossier({ qualification: "gros_potentiel" });
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, qualification: "gros_potentiel" })).toBe(true);
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, qualification: "non_qualifie" })).toBe(false);
  });

  it("l'étape", () => {
    const d = dossier({ stage: "visite" });
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, etape: "visite" })).toBe(true);
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, etape: "offre" })).toBe(false);
  });

  it("le responsable, « aucun » compris", () => {
    const sans = dossier({ assigneeIds: [] });
    const avec = dossier({ assigneeIds: ["u1"] });
    expect(passeLesFiltresAvances(sans, { ...FILTRES_AVANCES_VIDES, responsable: "aucun" })).toBe(true);
    expect(passeLesFiltresAvances(avec, { ...FILTRES_AVANCES_VIDES, responsable: "aucun" })).toBe(false);
    expect(passeLesFiltresAvances(avec, { ...FILTRES_AVANCES_VIDES, responsable: "u1" })).toBe(true);
    expect(passeLesFiltresAvances(avec, { ...FILTRES_AVANCES_VIDES, responsable: "u2" })).toBe(false);
  });

  it("le budget, par recouvrement de fourchettes", () => {
    const d = dossier({ budgetMinCents: 900_000_00, budgetMaxCents: 1_400_000_00 });
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, budget: "800k_1_2m" })).toBe(true);
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, budget: "1_2m_2m" })).toBe(true);
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, budget: "plus_3m" })).toBe(false);
  });

  /* Laisser passer partout un budget non renseigné faisait apparaître les
     mêmes dossiers dans cinq tranches incompatibles. */
  it("un budget inconnu ne tombe dans aucune tranche", () => {
    const d = dossier({ budgetMinCents: null, budgetMaxCents: null });
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, budget: "moins_800k" })).toBe(false);
    expect(passeLesFiltresAvances(d, { ...FILTRES_AVANCES_VIDES, budget: "tous" })).toBe(true);
  });

  it("compte les filtres actifs pour la pastille du bouton", () => {
    expect(nombreDeFiltresAvances(FILTRES_AVANCES_VIDES)).toBe(0);
    expect(
      nombreDeFiltresAvances({ ...FILTRES_AVANCES_VIDES, budget: "2m_3m", etape: "visite" }),
    ).toBe(2);
  });
});

describe("recherche", () => {
  it("cherche dans le nom, le téléphone, la ville et le projet", () => {
    const d = dossier();
    expect(correspondALaRecherche(d, "durand")).toBe(true);
    expect(correspondALaRecherche(d, "0612")).toBe(false);
    expect(correspondALaRecherche(d, "+336123")).toBe(true);
    expect(correspondALaRecherche(d, "cassis")).toBe(true);
    expect(correspondALaRecherche(d, "verdun")).toBe(true);
    expect(correspondALaRecherche(d, "   ")).toBe(true);
    expect(correspondALaRecherche(d, "marseille")).toBe(false);
  });
});

describe("filtrer", () => {
  it("combine les trois étages", () => {
    const dossiers = [
      dossier({ name: "A", callAttempts: 0, qualification: "gros_potentiel" }),
      dossier({ name: "B", callAttempts: 0, qualification: "non_qualifie" }),
      dossier({ name: "C", callAttempts: 2, qualification: "gros_potentiel" }),
    ];
    const retenus = filtrer(
      dossiers,
      {
        ...ETAT,
        signal: "a_contacter",
        avances: { ...FILTRES_AVANCES_VIDES, qualification: "gros_potentiel" },
      },
      MAINTENANT,
    );
    expect(retenus.map((d) => d.name)).toEqual(["A"]);
  });
});

describe("lecture des paramètres d'URL", () => {
  it("accepte les valeurs connues", () => {
    expect(lireSignal("a_rappeler")).toBe("a_rappeler");
    expect(lireEcheance("dus")).toBe("dus");
  });

  /* Un paramètre d'URL vient de l'extérieur : une valeur fantaisiste doit
     rendre la liste complète, jamais une liste vide inexplicable. */
  it("retombe sur « tous » devant l'inconnu", () => {
    expect(lireSignal("n_importe_quoi")).toBe("tous");
    expect(lireSignal(undefined)).toBe("tous");
    expect(lireSignal([])).toBe("tous");
    expect(lireEcheance("hier_peut_etre")).toBe("toutes");
  });

  it("retient la première valeur quand le paramètre est répété", () => {
    expect(lireSignal(["a_rappeler", "a_contacter"])).toBe("a_rappeler");
  });
});
