// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { LeadRow } from "./lead-row";
import type { Lead } from "@/modules/crm/leads";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());

const lead: Lead = {
  opportunityId: "opp-42",
  createdAt: "2026-07-30T09:00:00.000Z",
  stage: "nouveau",
  segment: "non_determine",
  processingStatus: "non_affecte",
  outcome: null,
  propertyType: "villa_architecte",
  city: "Annecy",
  postalCode: "74000",
  valueBand: "plus_2m",
  saleHorizon: "des_que_possible",
  mandateSituation: "aucun_mandat",
  compatibilityScore: 88,
  maturityScore: 72,
  recommendedPriority: "rappel_prioritaire",
  publicAppreciation: "fort_potentiel",
  contactId: "c-1",
  contactFirstName: "Marie",
  contactLastName: "Dupont",
  contactEmail: "marie@example.com",
  contactPhone: "+33612345678",
  contactPreference: "telephone",
  recallPreference: "matin",
  assignees: [],
  nextTask: null,
  lastActivityAt: null,
};

describe("LeadRow", () => {
  it("affiche le nom, le lien vers le dossier et les coordonnées si autorisé", () => {
    const { container, getByText, getAllByText } = render(
      <LeadRow lead={lead} canViewDetails={true} />,
    );
    expect(getByText("Marie Dupont")).toBeTruthy();
    expect(container.querySelector('a[href="/crm/mandats/opp-42"]')).toBeTruthy();
    expect(getByText("+33612345678")).toBeTruthy();
    expect(getByText("marie@example.com")).toBeTruthy();
    // Marqueurs opérationnels (« Fort potentiel » apparaît en chip et en appréciation).
    expect(getAllByText("Fort potentiel").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Non affecté")).toBeTruthy();
  });

  it("masque les coordonnées sensibles pour un rôle non autorisé", () => {
    const { queryByText, getAllByText } = render(<LeadRow lead={lead} canViewDetails={false} />);
    expect(queryByText("+33612345678")).toBeNull();
    expect(queryByText("marie@example.com")).toBeNull();
    expect(getAllByText("•••• masqué").length).toBeGreaterThanOrEqual(1);
  });

  it("rend une valeur longue lisible : nom tronqué mais accessible (title), e-mail qui passe à la ligne", () => {
    const longName = "Marie-Alexandra de la Rochefoucauld-Montmorency";
    const longEmail = "prenom.nom.tres.long@immobilier-prestige-cotedazur.example.com";
    const { getByText } = render(
      <LeadRow
        lead={{ ...lead, contactFirstName: "Marie-Alexandra", contactLastName: "de la Rochefoucauld-Montmorency", contactEmail: longEmail }}
        canViewDetails={true}
      />,
    );
    // Nom : troncature VOLONTAIRE (crm-ellipsis) MAIS valeur complète via title.
    const nameEl = getByText(longName);
    expect(nameEl.className).toContain("crm-ellipsis");
    expect(nameEl.getAttribute("title")).toBe(longName);
    // E-mail : valeur importante → passe à la ligne (crm-wrap), jamais rognée.
    const emailEl = getByText(longEmail);
    expect(emailEl.className).toContain("crm-wrap");
  });
});
