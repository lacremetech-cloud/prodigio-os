import { describe, expect, it } from "vitest";
import {
  aTraiterEnPriorite,
  compterPourCommercial,
  premierTraitement,
} from "./tableau-commercial";
import type { BuyerListItem } from "@/modules/buyers/crm/queries";

/** Dossier minimal : seuls les champs que le comptage regarde sont renseignés. */
function dossier(p: {
  lastInterestAt?: string | null;
  stage?: string;
  outcome?: string | null;
  overdue?: boolean;
  noNextAction?: boolean;
  id?: string;
  callAttempts?: number;
  dueAt?: string | null;
}): BuyerListItem {
  return {
    profile: {
      id: p.id ?? "x",
      last_interest_at: p.lastInterestAt ?? null,
      pipeline_stage: p.stage ?? "nouveau",
      outcome: p.outcome ?? null,
    },
    overdue: p.overdue ?? false,
    noNextAction: p.noNextAction ?? false,
    callAttempts: p.callAttempts ?? 0,
    stage: p.stage ?? "nouveau",
    nextTask: p.dueAt ? { due_at: p.dueAt } : null,
  } as unknown as BuyerListItem;
}

const maintenant = new Date().toISOString();
const hier = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

describe("compterPourCommercial", () => {
  it("ne compte comme arrivé aujourd’hui que ce qui date du jour", () => {
    const c = compterPourCommercial([
      dossier({ lastInterestAt: maintenant }),
      dossier({ lastInterestAt: hier }),
      dossier({ lastInterestAt: null }),
    ]);
    expect(c.nouveauxAujourdhui).toBe(1);
  });

  it("sépare le retard de l’absence de prochaine action", () => {
    // Un seul compteur additionnait les deux sous le libellé « À rappeler » :
    // un dossier sans tâche n'a pourtant aucun rappel à honorer, et la tuile
    // ouvrait une liste filtrée sur une moitié seulement du chiffre annoncé.
    const c = compterPourCommercial([
      dossier({ overdue: true }),
      dossier({ noNextAction: true }),
      dossier({ noNextAction: true }),
      dossier({}),
    ]);
    expect(c.enRetard).toBe(1);
    expect(c.sansAction).toBe(2);
  });

  it("écarte les dossiers clos de tous les chiffres", () => {
    // Un dossier perdu ne demande plus rien : le faire figurer gonflerait une
    // liste de travail qui doit rester exacte.
    const c = compterPourCommercial([
      dossier({ lastInterestAt: maintenant, overdue: true, stage: "visite" }),
      dossier({
        lastInterestAt: maintenant,
        overdue: true,
        stage: "visite",
        outcome: "perdu",
      }),
    ]);
    // `toEqual` et non `toMatchObject` : ce test doit tomber si un compteur
    // est ajoute sans qu'on se demande s'il exclut bien les dossiers clos.
    expect(c).toEqual({
      nouveauxAujourdhui: 1,
      enRetard: 1,
      sansAction: 0,
      dossiers: 1,
      aContacter: 1,
      rappelsDus: 0,
      enCours: 1,
    });
  });
});

describe("aTraiterEnPriorite", () => {
  it("fait passer le retard avant l’absence d’action", () => {
    // L'échéance avait été prise et elle est dépassée : c'est plus urgent
    // qu'un dossier pour lequel rien n'a encore été promis.
    const l = aTraiterEnPriorite([
      dossier({ id: "sans", noNextAction: true }),
      dossier({ id: "retard", overdue: true }),
    ]);
    expect(l.map((d) => d.profile.id)).toEqual(["retard", "sans"]);
  });

  it("classe les plus fraîches d’abord à urgence égale", () => {
    const l = aTraiterEnPriorite([
      dossier({ id: "vieux", noNextAction: true, lastInterestAt: hier }),
      dossier({ id: "frais", noNextAction: true, lastInterestAt: maintenant }),
    ]);
    expect(l.map((d) => d.profile.id)).toEqual(["frais", "vieux"]);
  });

  it("laisse de côté ce qui est à jour, et ce qui est clos", () => {
    const l = aTraiterEnPriorite([
      dossier({ id: "ok" }),
      dossier({ id: "clos", overdue: true, outcome: "perdu" }),
    ]);
    expect(l).toEqual([]);
  });
});

/**
 * Le premier traitement est la seule mesure qui dit si le travail du jour
 * avance. Deux pièges y sont vérifiés.
 */
describe("premier traitement", () => {
  it("compte un dossier une seule fois, quel que soit le nombre de tentatives", () => {
    const t = premierTraitement([
      dossier({ id: "a", callAttempts: 7 }),
      dossier({ id: "b", callAttempts: 1 }),
      dossier({ id: "c", callAttempts: 0 }),
    ]);
    expect(t).toMatchObject({ traites: 2, total: 3, restants: 1 });
  });

  /* Une tentative SANS REPONSE compte dans le premier traitement : elle a bien
     ete faite. Elle ne vaut pas « personne jointe » — confondre les deux fait
     croire a un travail abouti qui ne l'est pas. */
  it("compte une tentative sans réponse comme un premier traitement", () => {
    expect(premierTraitement([dossier({ callAttempts: 1 })]).pourcent).toBe(100);
  });

  /* Un perimetre vide n'est pas « 0 % traite » : il n'y a rien a traiter, et
     une division par zero donnerait NaN a l'ecran. */
  it("ne divise pas par zéro sur un périmètre vide", () => {
    expect(premierTraitement([])).toEqual({ traites: 0, total: 0, pourcent: 0, restants: 0 });
  });
});

describe("compteurs de travail", () => {
  /* « A contacter » n'est pas « sans action prevue ». */
  it("« à contacter » exclut les dossiers déjà appelés", () => {
    const c = compterPourCommercial([
      dossier({ id: "a", callAttempts: 0 }),
      dossier({ id: "b", callAttempts: 3, noNextAction: true }),
    ]);
    expect(c.aContacter).toBe(1);
  });

  /* « Dû » se lit a l'HEURE : un rappel pris pour ce soir ne demande rien
     maintenant, et un rappel pris pour la semaine prochaine encore moins. La
     tuile et le filtre `echeance=dus` de la liste comptent la meme chose. */
  it("« rappels dus » ne compte que les échéances atteintes ou dépassées", () => {
    const demain = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const ceSoir = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    const passe = new Date(Date.now() - 3600 * 1000).toISOString();
    const c = compterPourCommercial([
      dossier({ id: "a", dueAt: passe }),
      dossier({ id: "b", dueAt: ceSoir }),
      dossier({ id: "c", dueAt: demain }),
    ]);
    expect(c.rappelsDus).toBe(1);
  });

  it("« en cours » ne retient que les étapes où un échange est engagé", () => {
    const c = compterPourCommercial([
      dossier({ id: "a", stage: "nouveau" }),
      dossier({ id: "b", stage: "en_discussion" }),
      dossier({ id: "c", stage: "visite" }),
    ]);
    expect(c.enCours).toBe(2);
  });
});
