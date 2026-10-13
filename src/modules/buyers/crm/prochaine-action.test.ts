import { describe, expect, it } from "vitest";
import {
  estDu,
  etatRappel,
  prochaineAction,
  type TacheOuverte,
} from "./prochaine-action";

const MAINTENANT = new Date("2026-10-14T14:00:00.000Z").getTime();

function tache(over: Partial<TacheOuverte> = {}): TacheOuverte {
  return {
    id: "t1",
    title: "Rappeler",
    kind: "rappel",
    due_at: "2026-10-14T16:00:00.000Z",
    status: "a_faire",
    buyer_profile_id: "bp-1",
    interest_id: "int-1",
    ...over,
  };
}

describe("état d'un rappel", () => {
  it("la veille est un retard", () => {
    expect(etatRappel("2026-10-13T18:00:00.000Z", MAINTENANT)).toBe("en_retard");
  });

  /* Le point qui compte : un rappel pris pour 9 h et consulté à 14 h reste
     « aujourd'hui ». Le ranger dans les retards ferait paniquer pour une
     journée qui n'est pas finie. */
  it("le matin même n'est pas un retard", () => {
    expect(etatRappel("2026-10-14T09:00:00.000Z", MAINTENANT)).toBe("aujourdhui");
  });

  it("plus tard dans la journée est aussi aujourd'hui", () => {
    expect(etatRappel("2026-10-14T18:00:00.000Z", MAINTENANT)).toBe("aujourdhui");
  });

  it("demain est à venir", () => {
    expect(etatRappel("2026-10-15T08:00:00.000Z", MAINTENANT)).toBe("a_venir");
  });
});

describe("rappel dû", () => {
  /* « Dû » se lit à l'heure, pas au jour : c'est la mesure du tableau de bord,
     et elle répond à « qu'est-ce que je fais maintenant ». */
  it("l'heure est passée", () => {
    expect(estDu("2026-10-14T09:00:00.000Z", MAINTENANT)).toBe(true);
  });

  it("l'heure n'est pas encore venue, même aujourd'hui", () => {
    expect(estDu("2026-10-14T18:00:00.000Z", MAINTENANT)).toBe(false);
  });

  it("hier est dû", () => {
    expect(estDu("2026-10-13T18:00:00.000Z", MAINTENANT)).toBe(true);
  });
});

describe("prochaine action d'un dossier", () => {
  it("rien d'ouvert : aucune action", () => {
    expect(prochaineAction([], "int-1", MAINTENANT)).toBeNull();
  });

  it("une tâche faite ne compte pas", () => {
    expect(prochaineAction([tache({ status: "fait" })], "int-1", MAINTENANT)).toBeNull();
  });

  it("une tâche sans échéance ne compte pas", () => {
    expect(prochaineAction([tache({ due_at: null })], "int-1", MAINTENANT)).toBeNull();
  });

  /* Le défaut qui a motivé ce module : la liste disait « Aucune » pendant que
     la fiche affichait un rappel. Les deux appellent désormais cette fonction. */
  it("un rappel ouvert est toujours rendu, jamais « aucune »", () => {
    const a = prochaineAction([tache()], "int-1", MAINTENANT);
    expect(a).not.toBeNull();
    expect(a?.titre).toBe("Rappeler");
    expect(a?.etat).toBe("aujourdhui");
  });

  /* Caler une visite à Verdun ne doit pas donner « visite » à la ligne
     Jean Jaurès de la même personne. */
  it("une tâche d'un autre projet ne déborde pas sur celui-ci", () => {
    expect(
      prochaineAction([tache({ interest_id: "int-2" })], "int-1", MAINTENANT),
    ).toBeNull();
  });

  it("une tâche sans projet vaut pour toutes les lignes de la personne", () => {
    const a = prochaineAction([tache({ interest_id: null })], "int-1", MAINTENANT);
    expect(a?.generale).toBe(true);
  });

  it("entre le suivi général et la tâche du projet, la plus proche gagne", () => {
    const a = prochaineAction(
      [
        tache({ id: "generale", interest_id: null, due_at: "2026-10-20T10:00:00.000Z" }),
        tache({ id: "projet", interest_id: "int-1", due_at: "2026-10-15T10:00:00.000Z" }),
      ],
      "int-1",
      MAINTENANT,
    );
    expect(a?.id).toBe("projet");
  });

  it("un titre vide retombe sur l'intitulé du type", () => {
    const a = prochaineAction([tache({ title: "   ", kind: "visite" })], "int-1", MAINTENANT);
    expect(a?.titre).toBe("Visite");
  });
});
