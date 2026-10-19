import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { comptesParProjet } from "./comptes";
import { FILTRES_RAPIDES, porteLeSignal } from "./signaux";
import type { BuyerListItem, BuyerInboxRow } from "./queries";

/**
 * UN FILTRE QUI ANNONCE UN NOMBRE DOIT OUVRIR CE NOMBRE.
 *
 * Le pipeline montrait trois totaux pour le même écran : la barre de projets
 * annonçait 75, l'en-tête 72 cartes, le bandeau 67 actives. Les compteurs de
 * projet comptaient TOUS les dossiers, y compris les non qualifiés que le
 * pipeline écarte — cliquer « Villa Verdun 52 » en affichait moins.
 *
 * Et deux filtrages s'empilaient : la page filtrait déjà par `?signal=`, le
 * tableau refiltrait avec son propre vocabulaire local, sans compteur et sans
 * adresse. Deux mécanismes pour une seule intention.
 */

const item = (over: Record<string, unknown> = {}) =>
  ({
    interestId: "i-1",
    propertyId: "prop-1",
    propertyLabel: "Villa Verdun",
    name: "Essai",
    emailMasked: null,
    phoneMasked: null,
    city: "Cassis",
    stage: "a_contacter",
    qualification: "a_qualifier",
    qualificationReason: null,
    interestPropertyIds: ["prop-1"],
    properties: [{ id: "prop-1", label: "Villa Verdun" }],
    projets: [],
    assignees: [],
    nextTask: null,
    overdue: false,
    noNextAction: true,
    newInterest: true,
    budgetMinCents: null,
    budgetMaxCents: null,
    budgetChoice: null,
    profile: {
      id: "bp-1",
      qualification_status: "non_qualifie",
      recommended_priority: null,
      best_overall_score: null,
      interest_count: 1,
      last_interest_at: null,
      created_at: "2026-10-17T07:15:00.000Z",
    },
    ...over,
  }) as unknown as BuyerListItem;

describe("les compteurs de projet disent ce que la vue montre", () => {
  const items = [
    item({ propertyId: "verdun", interestPropertyIds: ["verdun"] }),
    item({ propertyId: "verdun", interestPropertyIds: ["verdun"] }),
    // Celle-ci est NON QUALIFIÉE : le pipeline ne l'affiche pas.
    item({
      propertyId: "verdun",
      interestPropertyIds: ["verdun"],
      qualification: "non_qualifie",
    }),
    item({ propertyId: "jaures", interestPropertyIds: ["jaures"] }),
  ];

  it("tout compté, Verdun en annonce trois — c'est le compte de la LISTE", () => {
    expect(comptesParProjet(items).get("verdun")).toBe(3);
  });

  it("filtré comme le pipeline, Verdun en annonce deux — et en affiche deux", () => {
    const dansLePipeline = (i: BuyerListItem) =>
      (i as unknown as { qualification: string }).qualification !== "non_qualifie";
    const comptes = comptesParProjet(items.filter(dansLePipeline));
    expect(comptes.get("verdun")).toBe(2);
    expect(comptes.get("jaures")).toBe(1);
    // Le total annoncé = le nombre de cartes posées. C'est tout l'invariant.
    expect([...comptes.values()].reduce((a, b) => a + b, 0)).toBe(
      items.filter(dansLePipeline).length,
    );
  });
});

describe("le câblage de la page pipeline", () => {
  const page = readFileSync("src/app/crm/acquereurs/pipeline/page.tsx", "utf8");

  it("compteurs et cartes passent par le MÊME prédicat", () => {
    expect(page).toContain("comptesParProjet(items.filter(dansLePipeline))");
    expect(page).toContain("visibles.filter(dansLePipeline)");
  });

  it("le paragraphe qui annonçait un troisième total a disparu", () => {
    expect(page).not.toContain("une par personne. Déplacer une");
  });

  it("les pastilles sont des LIENS : le filtre vit dans l'adresse", () => {
    expect(page).toContain("FILTRES_RAPIDES.map");
    expect(page).toContain("crm-rapide__n");
  });
});

describe("le tableau ne refiltre plus dans son coin", () => {
  const board = readFileSync("src/components/crm/buyers/buyer-kanban.tsx", "utf8");

  it("plus d'état de filtre local", () => {
    expect(board).not.toContain("setQuick");
    expect(board).not.toContain('"non_affecte"');
  });

  it("il ne lui reste que la recherche, qui n'a pas d'équivalent dans l'URL", () => {
    expect(board).toContain("}, [cards, search]);");
  });
});

describe("les deux vues proposent les mêmes pastilles", () => {
  it("une seule définition, partagée", () => {
    const liste = readFileSync("src/components/crm/buyers/buyer-inbox.tsx", "utf8");
    const page = readFileSync("src/app/crm/acquereurs/pipeline/page.tsx", "utf8");
    for (const source of [liste, page]) {
      expect(source).toContain("FILTRES_RAPIDES");
      expect(source).toContain("porteLeSignal");
    }
  });

  it("chaque pastille a un prédicat qui lui répond", () => {
    const vide = {
      stage: "a_contacter",
      qualification: "a_qualifier",
      overdue: false,
      noNextAction: false,
      unassigned: false,
      highPotential: false,
      phoneInvalid: false,
    } as unknown as BuyerInboxRow;
    for (const f of FILTRES_RAPIDES) {
      expect(() => porteLeSignal(vide, f.signal), f.signal).not.toThrow();
    }
    expect(FILTRES_RAPIDES.map((f) => f.signal)).toContain("fort_potentiel");
    expect(FILTRES_RAPIDES.map((f) => f.signal)).toContain("a_contacter");
  });
});
