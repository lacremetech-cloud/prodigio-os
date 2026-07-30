import { describe, expect, it } from "vitest";
import {
  applyLeadFilters,
  computeOverviewMetrics,
  isDueToday,
  isHighPotential,
  isOverdue,
  isUnassigned,
  sortLeads,
  type Lead,
} from "./leads";

const NOW = Date.parse("2026-07-30T12:00:00.000Z");

function makeLead(over: Partial<Lead> = {}): Lead {
  return {
    opportunityId: over.opportunityId ?? "opp-1",
    createdAt: over.createdAt ?? "2026-07-30T09:00:00.000Z",
    stage: over.stage ?? "nouveau",
    segment: over.segment ?? "non_determine",
    processingStatus: over.processingStatus ?? "non_affecte",
    outcome: over.outcome ?? null,
    propertyType: over.propertyType ?? "villa_architecte",
    city: over.city ?? "Annecy",
    postalCode: over.postalCode ?? "74000",
    valueBand: over.valueBand ?? "plus_2m",
    saleHorizon: over.saleHorizon ?? "des_que_possible",
    mandateSituation: over.mandateSituation ?? "aucun_mandat",
    compatibilityScore: over.compatibilityScore ?? 40,
    maturityScore: over.maturityScore ?? 40,
    recommendedPriority: over.recommendedPriority ?? "suivi_long_terme",
    publicAppreciation: over.publicAppreciation ?? "a_confirmer",
    contactId: over.contactId ?? "c-1",
    contactFirstName: over.contactFirstName ?? "Marie",
    contactLastName: over.contactLastName ?? "Dupont",
    contactEmail: over.contactEmail ?? "marie@example.com",
    contactPhone: over.contactPhone ?? "+33612345678",
    contactPreference: over.contactPreference ?? "telephone",
    recallPreference: over.recallPreference ?? "matin",
    assignees: over.assignees ?? [],
    nextTask: over.nextTask ?? null,
    lastActivityAt: over.lastActivityAt ?? null,
  };
}

describe("classification des leads", () => {
  it("isHighPotential vrai si priorité prioritaire, appréciation forte ou compat ≥ 60", () => {
    expect(isHighPotential(makeLead({ recommendedPriority: "rappel_prioritaire" }))).toBe(true);
    expect(isHighPotential(makeLead({ publicAppreciation: "fort_potentiel" }))).toBe(true);
    expect(isHighPotential(makeLead({ compatibilityScore: 60 }))).toBe(true);
    expect(
      isHighPotential(
        makeLead({
          recommendedPriority: "suivi_long_terme",
          publicAppreciation: "a_confirmer",
          compatibilityScore: 30,
        }),
      ),
    ).toBe(false);
  });

  it("isUnassigned selon la présence d'affectations", () => {
    expect(isUnassigned(makeLead({ assignees: [] }))).toBe(true);
    expect(
      isUnassigned(makeLead({ assignees: [{ userId: "u", responsibility: "setter", name: "u" }] })),
    ).toBe(false);
  });

  it("isOverdue / isDueToday selon l'échéance de la prochaine action", () => {
    const overdueLead = makeLead({
      nextTask: { id: "t", title: "Rappel", kind: "rappel", dueAt: "2026-07-30T08:00:00.000Z" },
    });
    const todayLead = makeLead({
      nextTask: { id: "t", title: "Rappel", kind: "rappel", dueAt: "2026-07-30T18:00:00.000Z" },
    });
    expect(isOverdue(overdueLead, NOW)).toBe(true);
    expect(isDueToday(overdueLead, NOW)).toBe(false);
    expect(isOverdue(todayLead, NOW)).toBe(false);
    expect(isDueToday(todayLead, NOW)).toBe(true);
    expect(isOverdue(makeLead(), NOW)).toBe(false);
  });
});

describe("filtres et recherche", () => {
  const leads = [
    makeLead({ opportunityId: "a", stage: "nouveau", assignees: [], contactLastName: "Martin" }),
    makeLead({
      opportunityId: "b",
      stage: "contact_etabli",
      assignees: [{ userId: "u1", responsibility: "setter", name: "u1" }],
      compatibilityScore: 90,
      contactLastName: "Bernard",
      city: "Chamonix",
    }),
    makeLead({
      opportunityId: "c",
      stage: "qualification_en_cours",
      assignees: [{ userId: "u1", responsibility: "setter", name: "u1" }],
      nextTask: { id: "t", title: "x", kind: "rappel", dueAt: "2026-07-29T10:00:00.000Z" },
      contactLastName: "Petit",
    }),
  ];

  it("filtre rapide 'non_affecte'", () => {
    const r = applyLeadFilters(leads, { quick: "non_affecte", search: "", stage: null }, NOW);
    expect(r.map((l) => l.opportunityId)).toEqual(["a"]);
  });

  it("filtre rapide 'fort_potentiel'", () => {
    const r = applyLeadFilters(leads, { quick: "fort_potentiel", search: "", stage: null }, NOW);
    expect(r.map((l) => l.opportunityId)).toEqual(["b"]);
  });

  it("filtre rapide 'en_retard'", () => {
    const r = applyLeadFilters(leads, { quick: "en_retard", search: "", stage: null }, NOW);
    expect(r.map((l) => l.opportunityId)).toEqual(["c"]);
  });

  it("recherche par nom / ville insensible à la casse", () => {
    expect(
      applyLeadFilters(leads, { quick: "tous", search: "bernard", stage: null }, NOW).map((l) => l.opportunityId),
    ).toEqual(["b"]);
    expect(
      applyLeadFilters(leads, { quick: "tous", search: "CHAMONIX", stage: null }, NOW).map((l) => l.opportunityId),
    ).toEqual(["b"]);
    expect(
      applyLeadFilters(leads, { quick: "tous", search: "", stage: null }, NOW).length,
    ).toBe(3);
  });
});

describe("tri", () => {
  const leads = [
    makeLead({ opportunityId: "a", createdAt: "2026-07-01T00:00:00.000Z", compatibilityScore: 10, maturityScore: 80, recommendedPriority: "nurturing" }),
    makeLead({ opportunityId: "b", createdAt: "2026-07-20T00:00:00.000Z", compatibilityScore: 90, maturityScore: 20, recommendedPriority: "rappel_prioritaire" }),
  ];
  it("tri récent / ancien", () => {
    expect(sortLeads(leads, "recent").map((l) => l.opportunityId)).toEqual(["b", "a"]);
    expect(sortLeads(leads, "ancien").map((l) => l.opportunityId)).toEqual(["a", "b"]);
  });
  it("tri priorité / compatibilité / maturité", () => {
    expect(sortLeads(leads, "priorite")[0]?.opportunityId).toBe("b");
    expect(sortLeads(leads, "compatibilite")[0]?.opportunityId).toBe("b");
    expect(sortLeads(leads, "maturite")[0]?.opportunityId).toBe("a");
  });
});

describe("indicateurs de la vue d'ensemble", () => {
  it("dérive les compteurs des données réelles (aucune fabrication)", () => {
    const leads = [
      makeLead({ opportunityId: "a", createdAt: "2026-07-30T06:00:00.000Z", stage: "nouveau", assignees: [] }),
      makeLead({ opportunityId: "b", createdAt: "2026-07-28T06:00:00.000Z", stage: "rendez_vous_planifie", assignees: [{ userId: "u", responsibility: "setter", name: "u" }] }),
      makeLead({ opportunityId: "c", createdAt: "2026-07-10T06:00:00.000Z", stage: "mandat_signe", assignees: [{ userId: "u", responsibility: "setter", name: "u" }] }),
      makeLead({ opportunityId: "d", createdAt: "2026-07-29T06:00:00.000Z", stage: "proposition_de_mandat", nextTask: { id: "t", title: "x", kind: "rappel", dueAt: "2026-07-29T10:00:00.000Z" }, assignees: [{ userId: "u", responsibility: "setter", name: "u" }] }),
    ];
    const m = computeOverviewMetrics(leads, new Set(["b"]), NOW);
    expect(m.total).toBe(4);
    expect(m.newToday).toBe(1); // a
    expect(m.newLast7Days).toBe(3); // a, b, d
    expect(m.unassigned).toBe(1); // a
    expect(m.overdueTasks).toBe(1); // d
    expect(m.appointmentsPlanned).toBe(1); // b
    expect(m.mandatesProposed).toBe(1); // d
    expect(m.mandatesSigned).toBe(1); // c
    expect(m.contactRate).toBe(25); // 1/4
  });

  it("taux de contact null si aucun lead", () => {
    expect(computeOverviewMetrics([], new Set(), NOW).contactRate).toBe(null);
  });
});
