import { describe, expect, it } from "vitest";

import {
  construireRecap,
  echappe,
  fenetreRecap,
  minutesDepuisMinuitParis,
  sujetRecap,
  type DossiersDormants,
  type LeadRecap,
} from "./recap";

const DORMANTS: DossiersDormants = {
  enRetard: 4,
  sansAction: 12,
  urlEnRetard: "https://go.prodigio.fr/crm/acquereurs?signal=en_retard",
  urlSansAction: "https://go.prodigio.fr/crm/acquereurs?signal=sans_action",
};

function lead(p: Partial<LeadRecap> = {}): LeadRecap {
  return {
    nom: "Claire Mounier",
    telephone: "0611223344",
    bien: "Villa Verdun",
    budgetChoice: "500k_1m",
    recuLe: new Date("2026-10-22T07:14:00Z"),
    ficheUrl: "https://go.prodigio.fr/crm/acquereurs/abc",
    dejaAlerte: false,
    ...p,
  };
}

/** Heure d'ete : Paris = UTC+2. 13h00 Paris = 11h00 UTC. */
const PARIS_13H00 = new Date("2026-10-22T11:00:00Z");

describe("la fenetre du recapitulatif", () => {
  it("remonte au creneau precedent, pas a une duree fixe", () => {
    const { debut } = fenetreRecap(PARIS_13H00);
    // 8h30 Paris = 6h30 UTC le meme jour.
    expect(debut.toISOString()).toBe("2026-10-22T06:30:00.000Z");
  });

  it("rend la MEME fenetre quand l'envoi part en retard", () => {
    const aLHeure = fenetreRecap(PARIS_13H00).debut.toISOString();
    const enRetard = fenetreRecap(new Date("2026-10-22T11:07:00Z")).debut.toISOString();
    expect(enRetard).toBe(aLHeure);
  });

  it("remonte au 17h30 de la veille pour le creneau de 8h30", () => {
    // 8h30 Paris = 6h30 UTC.
    const { debut } = fenetreRecap(new Date("2026-10-22T06:30:00Z"));
    // 17h30 Paris la veille = 15h30 UTC.
    expect(debut.toISOString()).toBe("2026-10-21T15:30:00.000Z");
  });

  it("remonte a 13h00 pour le creneau de 17h30", () => {
    const { debut } = fenetreRecap(new Date("2026-10-22T15:32:00Z"));
    expect(debut.toISOString()).toBe("2026-10-22T11:00:00.000Z");
  });

  it("signale un appel passe hors creneau", () => {
    expect(fenetreRecap(PARIS_13H00).manuel).toBe(false);
    // 4h00 Paris : aucun creneau a moins de 90 minutes.
    expect(fenetreRecap(new Date("2026-10-22T02:00:00Z")).manuel).toBe(true);
  });

  it("garde une fenetre utilisable hors creneau", () => {
    const { debut } = fenetreRecap(new Date("2026-10-22T02:00:00Z"));
    expect(debut.getTime()).toBeLessThan(new Date("2026-10-22T02:00:00Z").getTime());
  });

  it("lit l'heure de Paris, pas celle du serveur", () => {
    expect(minutesDepuisMinuitParis(PARIS_13H00)).toBe(13 * 60);
    // Heure d'hiver : 13h00 Paris = 12h00 UTC.
    expect(minutesDepuisMinuitParis(new Date("2026-11-15T12:00:00Z"))).toBe(13 * 60);
  });
});

describe("l'objet du mail", () => {
  it("compte les leads et signale les gros budgets", () => {
    expect(
      sujetRecap([lead(), lead({ budgetChoice: "plus_1m" }), lead({ budgetChoice: "1m_2m" })]),
    ).toBe("3 nouveaux leads — 2 au-dessus de 1 M€");
  });

  it("reste au singulier pour un seul lead", () => {
    expect(sujetRecap([lead({ budgetChoice: "plus_1m" })])).toBe(
      "1 nouveau lead — 1 au-dessus de 1 M€",
    );
  });

  it("ne mentionne pas les gros budgets quand il n'y en a pas", () => {
    expect(sujetRecap([lead(), lead()])).toBe("2 nouveaux leads");
  });
});

describe("le corps du mail", () => {
  it("n'envoie RIEN quand le creneau n'a apporte aucun lead", () => {
    const r = construireRecap({
      leads: [],
      dormants: DORMANTS,
      maintenant: PARIS_13H00,
      depuis: new Date("2026-10-22T06:30:00Z"),
    });
    expect(r.envoyer).toBe(false);
    expect(r.html).toBe("");
  });

  it("met les budgets au-dessus d'1 M€ en bloc, avant les autres", () => {
    const r = construireRecap({
      leads: [
        lead({ nom: "Claire Mounier" }),
        lead({ nom: "Helene Vasseur", budgetChoice: "plus_1m" }),
      ],
      dormants: DORMANTS,
      maintenant: PARIS_13H00,
      depuis: new Date("2026-10-22T06:30:00Z"),
    });
    expect(r.envoyer).toBe(true);
    expect(r.html.indexOf("Helene Vasseur")).toBeLessThan(r.html.indexOf("Claire Mounier"));
    expect(r.html).toContain("PLUS D'1 M€");
  });

  it("marque les leads deja alertes, pour ne pas faire croire a un oubli", () => {
    const r = construireRecap({
      leads: [lead({ budgetChoice: "plus_1m", dejaAlerte: true })],
      dormants: DORMANTS,
      maintenant: PARIS_13H00,
      depuis: new Date("2026-10-22T06:30:00Z"),
    });
    expect(r.html).toContain("déjà alerté par mail");
  });

  it("rend le telephone appelable, et le dit quand il n'y en a pas", () => {
    const avec = construireRecap({
      leads: [lead({ telephone: "06 11 22 33 44" })],
      dormants: DORMANTS,
      maintenant: PARIS_13H00,
      depuis: new Date("2026-10-22T06:30:00Z"),
    });
    expect(avec.html).toContain('href="tel:0611223344"');

    const sans = construireRecap({
      leads: [lead({ telephone: null })],
      dormants: DORMANTS,
      maintenant: PARIS_13H00,
      depuis: new Date("2026-10-22T06:30:00Z"),
    });
    expect(sans.html).toContain("pas de numéro");
  });

  it("reprend les deux signaux du CRM, avec leurs liens", () => {
    const r = construireRecap({
      leads: [lead()],
      dormants: DORMANTS,
      maintenant: PARIS_13H00,
      depuis: new Date("2026-10-22T06:30:00Z"),
    });
    expect(r.html).toContain("4 dossiers en retard");
    expect(r.html).toContain("12 sans prochaine action");
    expect(r.html).toContain("signal=en_retard");
    expect(r.html).toContain("signal=sans_action");
  });

  it("n'affiche pas le bandeau du bas quand rien ne dort", () => {
    const r = construireRecap({
      leads: [lead()],
      dormants: { ...DORMANTS, enRetard: 0, sansAction: 0 },
      maintenant: PARIS_13H00,
      depuis: new Date("2026-10-22T06:30:00Z"),
    });
    expect(r.html).not.toContain("en retard");
    expect(r.html).not.toContain("sans prochaine action");
  });

  it("neutralise ce qu'un formulaire pourrait injecter", () => {
    const r = construireRecap({
      leads: [lead({ nom: '<script>alert("x")</script>' })],
      dormants: DORMANTS,
      maintenant: PARIS_13H00,
      depuis: new Date("2026-10-22T06:30:00Z"),
    });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("echappe les caracteres de balisage", () => {
    expect(echappe('a<b>&"c')).toBe("a&lt;b&gt;&amp;&quot;c");
  });
});
