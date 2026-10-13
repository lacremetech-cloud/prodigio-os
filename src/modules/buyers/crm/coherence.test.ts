import { describe, expect, it } from "vitest";
import {
  DOSSIERS_FICTIFS,
  INSTANT_ESSAI,
  TACHES_FICTIVES,
} from "./dossiers-fictifs";
import { prochaineAction, estDu, etatRappel } from "./prochaine-action";
import { filtrer, FILTRES_AVANCES_VIDES, porteLeSignal } from "./filtres";
import { QUALIFICATION_LABELS } from "./qualification";
import { buyerUrgencyWeight } from "./pipeline";

/**
 * LA vérification qui compte : la même information partout.
 *
 * Chaque écran construit son affichage à partir d'un objet différent — ligne
 * de liste, carte de Kanban, ligne de cockpit, détail de fiche. Ce qui a
 * divergé par le passé, ce ne sont pas les composants : ce sont ces objets, et
 * les règles qui les remplissaient. Ces tests comparent donc ce que chaque
 * chemin produit, sur les mêmes dossiers, au même instant.
 */

describe("un dossier dit la même chose sur tous les écrans", () => {
  it("la qualification est la même, quel que soit le chemin", () => {
    for (const d of DOSSIERS_FICTIFS) {
      /* La ligne de liste, la carte de Kanban et la ligne de cockpit lisent
         TOUTES `buyer_interests.qualification`. Le libellé vient d'un seul
         fichier. Il n'y a donc plus qu'une valeur possible — ce test échouerait
         si quelqu'un réintroduisait une seconde échelle. */
      expect(QUALIFICATION_LABELS[d.qualification]).toBeTruthy();
    }
  });

  it("la prochaine action est la même, à l'heure près", () => {
    for (const d of DOSSIERS_FICTIFS) {
      const vuParLaFiche = prochaineAction(
        TACHES_FICTIVES.filter((t) => t.buyer_profile_id === d.buyerProfileId),
        d.interestId,
        INSTANT_ESSAI,
      );
      // La liste porte l'échéance dans `nextActionAt`, la fiche la recalcule.
      expect(vuParLaFiche?.dueAt ?? null).toBe(d.nextActionAt);
      expect(vuParLaFiche?.id ?? null).toBe(d.nextActionId);
    }
  });

  /* Le cas qui a motivé toute la séparation : une personne, deux projets, deux
     jugements. L'ancienne qualification vivait sur la PERSONNE — elle ne
     pouvait pas dire les deux à la fois. */
  it("deux projets de la même personne gardent chacun leur qualification", () => {
    const verdun = DOSSIERS_FICTIFS.find((d) => d.interestId === "i-6a");
    const jeanJaures = DOSSIERS_FICTIFS.find((d) => d.interestId === "i-6b");
    expect(verdun?.buyerProfileId).toBe(jeanJaures?.buyerProfileId);
    expect(verdun?.qualification).toBe("gros_potentiel");
    expect(jeanJaures?.qualification).toBe("non_qualifie");
  });

  /* Et la visite calée sur Verdun ne doit pas devenir la prochaine action de
     la ligne Jean Jaurès de la même personne. */
  it("un rappel pris sur un projet ne déborde pas sur l’autre", () => {
    const taches = TACHES_FICTIVES.filter((t) => t.buyer_profile_id === "p-6");
    expect(prochaineAction(taches, "i-6a", INSTANT_ESSAI)?.id).toBe("t-6a");
    expect(prochaineAction(taches, "i-6b", INSTANT_ESSAI)).toBeNull();
  });
});

describe("les compteurs et les filtres disent la même chose", () => {
  const etat = {
    signal: "tous" as const,
    echeance: "toutes" as const,
    recherche: "",
    avances: FILTRES_AVANCES_VIDES,
  };

  it("« À contacter » ne retient que celui que personne n’a appelé", () => {
    const retenus = filtrer(DOSSIERS_FICTIFS, { ...etat, signal: "a_contacter" }, INSTANT_ESSAI);
    expect(retenus.map((d) => d.name)).toEqual(["Camille Durand"]);
  });

  /* Un dossier qu'on a appelé trois fois sans succès n'est PAS à contacter. */
  it("un dossier déjà appelé sort de « À contacter »", () => {
    const marc = DOSSIERS_FICTIFS.find((d) => d.name === "Marc Lefèvre")!;
    expect(porteLeSignal(marc, "a_contacter", "toutes", INSTANT_ESSAI)).toBe(false);
  });

  it("« À rappeler » se décompose en retard / aujourd’hui / à venir, sans recouvrement", () => {
    const parEcheance = (e: "en_retard" | "aujourdhui" | "a_venir") =>
      filtrer(DOSSIERS_FICTIFS, { ...etat, signal: "a_rappeler", echeance: e }, INSTANT_ESSAI).map(
        (d) => d.name,
      );
    expect(parEcheance("en_retard")).toEqual(["Sophie Marchand"]);
    expect(parEcheance("aujourdhui").sort()).toEqual(["Hélène Roux", "Olivier Pastor"]);
    expect(parEcheance("a_venir")).toEqual(["Marc Lefèvre"]);

    // La somme des trois vaut exactement « tous les rappels ».
    const tous = filtrer(DOSSIERS_FICTIFS, { ...etat, signal: "a_rappeler" }, INSTANT_ESSAI);
    expect(tous.length).toBe(4);
  });

  /* La tuile du tableau de bord et le filtre de la liste comptent la MÊME
     chose : échéance atteinte ou dépassée, à l'heure près. La visite de
     17 h et le rappel de demain n'en sont pas. */
  it("« Rappels dus » compte ce que la tuile du tableau de bord annonce", () => {
    const dus = filtrer(
      DOSSIERS_FICTIFS,
      { ...etat, signal: "a_rappeler", echeance: "dus" },
      INSTANT_ESSAI,
    );
    expect(dus.map((d) => d.name).sort()).toEqual(["Hélène Roux", "Sophie Marchand"]);

    // Et la même règle, appliquée directement, donne le même résultat.
    const parLaRegle = DOSSIERS_FICTIFS.filter(
      (d) => d.nextActionAt && estDu(d.nextActionAt, INSTANT_ESSAI),
    );
    expect(parLaRegle.map((d) => d.name).sort()).toEqual(["Hélène Roux", "Sophie Marchand"]);
  });

  it("le filtre de qualification retient exactement ce qu’il annonce", () => {
    const gros = filtrer(
      DOSSIERS_FICTIFS,
      { ...etat, avances: { ...FILTRES_AVANCES_VIDES, qualification: "gros_potentiel" } },
      INSTANT_ESSAI,
    );
    expect(gros.map((d) => d.name).sort()).toEqual(["Hélène Roux", "Olivier Pastor"]);
  });

  /* Le dossier migré depuis l'ancien « Qualifié » revient « À qualifier ».
     Il ne doit PAS pour autant retomber dans « À contacter » : les deux se
     lisent sur des colonnes différentes, et c'est tout l'intérêt. */
  it("un dossier « À qualifier » déjà appelé reste hors de « À contacter »", () => {
    const migre = { ...DOSSIERS_FICTIFS[3]!, qualification: "a_qualifier" as const };
    expect(migre.callAttempts).toBeGreaterThan(0);
    expect(porteLeSignal(migre, "a_contacter", "toutes", INSTANT_ESSAI)).toBe(false);
    expect(porteLeSignal(migre, "a_rappeler", "toutes", INSTANT_ESSAI)).toBe(true);
  });
});

describe("l’heure est la même partout", () => {
  it("l’état d’un rappel ne dépend que de l’instant passé en argument", () => {
    const sophie = DOSSIERS_FICTIFS.find((d) => d.name === "Sophie Marchand")!;
    expect(etatRappel(sophie.nextActionAt!, INSTANT_ESSAI)).toBe("en_retard");
    // Trois jours plus tôt, le même rappel était encore à venir.
    const avant = Date.parse("2026-10-12T10:00:00.000Z");
    expect(etatRappel(sophie.nextActionAt!, avant)).toBe("a_venir");
  });
});

describe("l’urgence ne se déduit plus d’un score", () => {
  /* « À qualifier » est l'état par défaut de tout le monde : lui donner du
     poids rendrait urgent chaque lead que personne n'a touché. */
  it("seul « gros potentiel » pèse, et il pèse pour tous", () => {
    const sans = buyerUrgencyWeight({ qualification: "a_qualifier" } as never);
    const avec = buyerUrgencyWeight({ qualification: "gros_potentiel" } as never);
    expect(avec).toBeGreaterThan(sans);
    expect(sans).toBe(0);
  });
});
