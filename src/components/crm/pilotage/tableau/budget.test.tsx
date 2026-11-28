// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PilotageBudgetFormulaireRow } from "@/lib/supabase/types";
import { entier, type Exact } from "@/modules/pilotage/exact";
import type { LigneCrmBudget } from "@/modules/pilotage/budget";
import type { BienCalcule, TableauPilotage } from "@/modules/pilotage/tableau";
import type { LectureCrm } from "@/modules/pilotage/tableau-lecture";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { SectionBudgetBien } = await import("./budget");
const { HistoriqueBudget, ResumeBudget } = await import("../budget-vues");

/**
 * « Le budget déclaré » et les vues du réglage, rendus sur des données
 * fictives : ce qui s'affiche, et ce qui manque, dit manquant.
 */

afterEach(() => cleanup());

const BIEN = "aaaaaaaa-0000-4000-8000-000000000001";
const M = 100_000_000;
const texte = () => (document.body.textContent ?? "").replace(/[  ]/g, " ");

function tableau(): TableauPilotage {
  const pubs = new Map<string, Map<string, Exact>>([["11", new Map([["2026-11-05", entier(40_000)]])]]);
  const quotidien = new Map([[BIEN, new Map([["2026-11-05", { depense: entier(70_000), leads: entier(7) }]])]]);
  return {
    jour: "2026-11-28",
    periode: { debut: "2026-11-01", fin: "2026-11-27", libelle: "Novembre (fictif)", choix: { type: "dates", debut: "2026-11-01", fin: "2026-11-27" } },
    lecture: { lu: true },
    noms: { pubs: new Map([["11", "VILLA | ESSAI | V1"]]), campagnes: new Map() },
    fichesPubs: new Map(),
    quotidien,
    quotidienParPub: new Map([[BIEN, pubs]]),
  } as unknown as TableauPilotage;
}

const b = { id: BIEN, nom: "Villa essai" } as BienCalcule;

function ligne(p: Partial<LigneCrmBudget>): LigneCrmBudget {
  return { regroupement: "bien", property_id: BIEN, niveau: null, ad_id: null, campaign_id: null, reponse: null, demandes: 0, personnes: 0, qualifies: 0, ...p };
}

function crm(lignes: LigneCrmBudget[], budget: "ok" | "non_installe" = "ok"): LectureCrm {
  return {
    etat: "ok",
    parJour: [],
    cohorte: new Map(),
    parPub: [],
    debuts: new Map([[BIEN, "2026-10-14"]]),
    budget: budget === "ok" ? { etat: "ok", lignes } : { etat: "non_installe" },
  };
}

const version: PilotageBudgetFormulaireRow = {
  id: "v1",
  property_id: BIEN,
  date_effet: "2026-11-28",
  tranches: ["500k_1m", "plus_1m"],
  cible_min_cents: 1 * M,
  motif: "Seuil fictif",
  saisi_le: "2026-11-28T10:00:00Z",
  saisi_par: null,
};

const LIGNES = [
  ligne({ reponse: "aucun_projet", demandes: 3, personnes: 3 }),
  ligne({ reponse: "500k_1m", demandes: 2, personnes: 2, qualifies: 1 }),
  ligne({ reponse: "plus_1m", demandes: 5, personnes: 4, qualifies: 3 }),
  ligne({ regroupement: "pub", niveau: "pub", ad_id: "11", reponse: "plus_1m", demandes: 4, personnes: 3, qualifies: 2 }),
  ligne({ regroupement: "pub", niveau: "pub", ad_id: "11", reponse: "aucun_projet", demandes: 1, personnes: 1 }),
];

describe("la section « Le budget déclaré »", () => {
  it("avec une cible : la cible, les tuiles, les réponses et les pubs", () => {
    render(<SectionBudgetBien t={tableau()} b={b} crm={crm(LIGNES)} budgets={{ etat: "ok", donnees: [version] }} />);
    const t = texte();
    expect(t).toContain("Cible en vigueur : à partir de 1 M€");
    expect(t).toContain("sur 10 demandes");
    // 5 demandes « plus d'1 M€ » sur 10 qui ont répondu.
    expect(t).toContain("5 · 50,00 %");
    // 700 € de dépense (mêmes jours) ÷ 5 demandes dans la cible.
    expect(t).toContain("140,00 €");
    expect(screen.getByRole("rowheader", { name: "Plus d'1 M€" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: /VILLA \| ESSAI \| V1/ })).toBeTruthy();
    // La pub 11 : 400 € ÷ 4 demandes dans la cible.
    expect(t).toContain("100,00 €");
  });

  it("sans cible : les réponses se lisent, la part et le coût sont « manquants », jamais 0", () => {
    render(<SectionBudgetBien t={tableau()} b={b} crm={crm(LIGNES)} budgets={{ etat: "ok", donnees: [] }} />);
    const t = texte();
    expect(t).toContain("Cible non réglée");
    expect(t).toContain("manquant — cible non réglée");
    expect(t).toContain("sur 4 personnes qualifiées");
    // Aucune réponse n'est dite « dans la cible » ou non : la colonne reste vide.
    for (const r of ["Pas de projet", "500 000 € – 1 M€", "Plus d'1 M€"]) {
      const cellules = screen.getByRole("rowheader", { name: r }).closest("tr")!.querySelectorAll("td");
      expect(cellules[cellules.length - 1]!.textContent, r).toBe("—");
    }
    expect(screen.getByRole("link", { name: /Régler le budget du formulaire/ }).getAttribute("href")).toBe(
      `/crm/pilotage/donnees/${BIEN}#budget`,
    );
  });

  it("migration absente : seule cette section le dit", () => {
    render(<SectionBudgetBien t={tableau()} b={b} crm={crm([], "non_installe")} budgets={{ etat: "ok", donnees: [] }} />);
    expect(texte()).toContain("attend l’installation de la migration du 28/11/2026");
  });
});

describe("le réglage, dans les données du pilotage", () => {
  it("sans réglage : les réponses d'aujourd'hui, et la proposition d'après le prix", () => {
    render(
      <ResumeBudget
        reglage={null}
        proposition={{ tranches: ["1m_2m", "2m_3m", "plus_3m"], cibleMinCentimes: 3 * M, prixCentimes: 4 * M, depuis: "prix_affiche" }}
      />,
    );
    const t = texte();
    expect(t).toContain("Pas de projet · 500 000 € – 1 M€ · Plus d'1 M€");
    expect(t).toContain("Proposition d’après le prix affiché");
    expect(t).toContain("Pas de projet · 1 – 2 M€ · 2 – 3 M€ · Plus de 3 M€ ; cible à partir de 3 M€");
  });

  it("l'historique : chaque version, son état, ses réponses, sa cible, son motif", () => {
    const avenir = { ...version, id: "v2", date_effet: "2026-12-15", tranches: ["plus_3m"], cible_min_cents: 3 * M, motif: "À venir" };
    render(<HistoriqueBudget versions={[version, avenir]} jour="2026-11-28" membres={new Map()} />);
    const t = texte();
    expect(t).toContain("En vigueur");
    expect(t).toContain("À venir");
    expect(t).toContain("Seuil fictif");
    expect(t).toContain("à partir de 1 M€");
  });
});
