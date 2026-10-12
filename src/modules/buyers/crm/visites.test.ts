import { describe, expect, it } from "vitest";
import { grouperParJour, repartirVisites, type Visite } from "./visites";

function visite(startsAt: string, taskId = startsAt): Visite {
  return {
    taskId,
    buyerProfileId: "p1",
    startsAt,
    title: "Visite du bien",
    status: "a_faire",
    name: "Dupont",
    phoneMasked: null,
    propertyLabel: "Villa Verdun",
    city: "Cassis",
    assigneeName: null,
  };
}

const T = Date.parse("2026-10-14T12:00:00.000Z");

describe("repartirVisites", () => {
  it("sépare ce qui vient de ce qui a eu lieu", () => {
    const { aVenir, passees } = repartirVisites(
      [
        visite("2026-10-13T10:00:00.000Z"),
        visite("2026-10-14T15:00:00.000Z"),
        visite("2026-10-15T09:00:00.000Z"),
      ],
      T,
    );
    expect(aVenir.map((v) => v.startsAt)).toEqual([
      "2026-10-14T15:00:00.000Z",
      "2026-10-15T09:00:00.000Z",
    ]);
    expect(passees.map((v) => v.startsAt)).toEqual(["2026-10-13T10:00:00.000Z"]);
  });

  it("montre les visites passées de la plus récente à la plus ancienne", () => {
    // C'est ce qui vient d'avoir lieu qu'on doit débriefer, pas le mois dernier.
    const { passees } = repartirVisites(
      [visite("2026-10-01T10:00:00.000Z"), visite("2026-10-13T10:00:00.000Z")],
      T,
    );
    expect(passees.map((v) => v.startsAt)).toEqual([
      "2026-10-13T10:00:00.000Z",
      "2026-10-01T10:00:00.000Z",
    ]);
  });

  it("range une date illisible dans le passé plutôt que de la faire disparaître", () => {
    const { aVenir, passees } = repartirVisites([visite("pas-une-date")], T);
    expect(aVenir).toHaveLength(0);
    expect(passees).toHaveLength(1);
  });
});

describe("grouperParJour", () => {
  it("regroupe les visites d’une même journée sans réordonner", () => {
    const groupes = grouperParJour([
      visite("2026-10-14T09:00:00.000Z", "a"),
      visite("2026-10-14T15:00:00.000Z", "b"),
      visite("2026-10-15T09:00:00.000Z", "c"),
    ]);
    expect(groupes.map((g) => g.jour)).toEqual(["2026-10-14", "2026-10-15"]);
    expect(groupes[0].visites.map((v) => v.taskId)).toEqual(["a", "b"]);
  });

  it("ne fusionne pas deux journées identiques séparées par une autre", () => {
    const groupes = grouperParJour([
      visite("2026-10-14T09:00:00.000Z", "a"),
      visite("2026-10-15T09:00:00.000Z", "b"),
      visite("2026-10-14T20:00:00.000Z", "c"),
    ]);
    expect(groupes).toHaveLength(3);
  });
});
