import { describe, expect, it } from "vitest";
import { arriveesParJour, datesDArrivee, variationArrivees } from "./arrivees";
import type { BuyerListItem } from "./queries";

/** La courbe ne reçoit que des dates : une date absente n'y arrive jamais. */
function dossier(createdAt: string | null): string {
  return createdAt ?? "";
}

/** Midi local, pour qu'aucun décalage horaire ne fasse basculer de jour. */
function jourLocal(decalage: number, reference: number): string {
  const d = new Date(reference);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + decalage);
  return d.toISOString();
}

const MAINTENANT = new Date(2026, 9, 12, 15, 0, 0).getTime();

describe("arriveesParJour", () => {
  it("rend une case par jour, zéros compris", () => {
    // Omettre les jours vides tasserait le graphique et ferait passer un creux
    // pour une continuité.
    const serie = arriveesParJour([dossier(jourLocal(0, MAINTENANT))], 7, MAINTENANT);
    expect(serie).toHaveLength(7);
    expect(serie.map((j) => j.nombre)).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });

  it("compte plusieurs arrivées le même jour", () => {
    const serie = arriveesParJour(
      [dossier(jourLocal(-1, MAINTENANT)), dossier(jourLocal(-1, MAINTENANT))],
      7,
      MAINTENANT,
    );
    expect(serie[5]?.nombre).toBe(2);
  });

  it("ignore ce qui tombe hors de la fenêtre", () => {
    const serie = arriveesParJour([dossier(jourLocal(-40, MAINTENANT))], 7, MAINTENANT);
    expect(serie).toHaveLength(7);
    expect(serie.every((j) => j.nombre === 0)).toBe(true);
  });

  it("ne trébuche ni sur une date absente ni sur une date illisible", () => {
    const serie = arriveesParJour(
      [dossier(null), dossier("pas-une-date"), dossier(jourLocal(0, MAINTENANT))],
      7,
      MAINTENANT,
    );
    expect(serie.reduce((t, j) => t + j.nombre, 0)).toBe(1);
  });
});

describe("variationArrivees", () => {
  it("compare la période à celle qui la précède", () => {
    const items = [
      // Période courante (7 derniers jours) : 3
      dossier(jourLocal(0, MAINTENANT)),
      dossier(jourLocal(-2, MAINTENANT)),
      dossier(jourLocal(-6, MAINTENANT)),
      // Période précédente (jours -7 à -13) : 2
      dossier(jourLocal(-8, MAINTENANT)),
      dossier(jourLocal(-12, MAINTENANT)),
    ];
    expect(variationArrivees(items, 7, MAINTENANT)).toBe(50);
  });

  it("rend null quand la période précédente est vide", () => {
    // On ne divise pas par zéro, et « +∞ % » n'apprend rien.
    const items = [dossier(jourLocal(0, MAINTENANT))];
    expect(variationArrivees(items, 7, MAINTENANT)).toBeNull();
  });

  it("sait dire une baisse", () => {
    const items = [
      dossier(jourLocal(-8, MAINTENANT)),
      dossier(jourLocal(-9, MAINTENANT)),
      dossier(jourLocal(-10, MAINTENANT)),
      dossier(jourLocal(-11, MAINTENANT)),
      dossier(jourLocal(-1, MAINTENANT)),
    ];
    expect(variationArrivees(items, 7, MAINTENANT)).toBe(-75);
  });
});

describe("datesDArrivee", () => {
  it("n'extrait que les dates de création, et écarte celles qui manquent", () => {
    // La courbe est un composant client : lui passer les dossiers enverrait au
    // navigateur la ligne contact brute, coordonnées non masquées comprises.
    const items = [
      { profile: { created_at: "2026-10-01T10:00:00.000Z" } },
      { profile: { created_at: null } },
      { profile: { created_at: "2026-10-02T10:00:00.000Z" } },
    ] as unknown as BuyerListItem[];
    expect(datesDArrivee(items)).toEqual([
      "2026-10-01T10:00:00.000Z",
      "2026-10-02T10:00:00.000Z",
    ]);
  });
});
