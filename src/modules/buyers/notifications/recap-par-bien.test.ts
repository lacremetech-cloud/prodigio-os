import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { construireRecap, sujetRecap, type DossiersDormants, type LeadRecap } from "./recap";

/**
 * UN RÉCAPITULATIF PAR BIEN.
 *
 * Le 6 novembre, en préparant l'arrivée d'Édouard ROWLANDSON (Cimalpes) :
 * le récapitulatif de 8 h 30, 13 h et 17 h 30 était UN seul e-mail, tous biens
 * confondus, vers une liste écrite en dur dans Make. Deux défauts jumeaux :
 *
 *   - Édouard n'y était pas : aucun des leads qu'il doit traiter.
 *   - Nicolas, qui ne suit que Cassis, y lisait ceux des 2 Alpes.
 *
 * L'isolation tenait dans le CRM et pas dans ce mail. Ce fichier garde le
 * découpage et, surtout, le fait que la liste des destinataires ne redevienne
 * jamais une constante.
 */

const DORMANTS: DossiersDormants = {
  enRetard: 2,
  sansAction: 1,
  urlEnRetard: "https://go.prodigio.fr/crm/acquereurs?projets=p1&signal=en_retard",
  urlSansAction: "https://go.prodigio.fr/crm/acquereurs?projets=p1&signal=sans_action",
};

function lead(budget: string | null): LeadRecap {
  return {
    nom: "Alex Martin",
    telephone: "+33612345678",
    bien: "Les Airelles aux 2 Alpes",
    budgetChoice: budget,
    recuLe: new Date("2026-11-06T09:12:00Z"),
    ficheUrl: "https://go.prodigio.fr/crm/acquereurs/abc",
    dejaAlerte: false,
  };
}

describe("l'objet nomme le bien", () => {
  it("le met en tête, pour qu'on distingue trois mails dans la même boîte", () => {
    expect(sujetRecap([lead("plus_1m")], "Les Airelles aux 2 Alpes")).toBe(
      "Les Airelles aux 2 Alpes · 1 nouveau lead — 1 au-dessus de 1 M€",
    );
  });

  it("sans bien, l'objet est EXACTEMENT celui d'avant", () => {
    // Les champs globaux restent servis le temps que Make bascule : ils ne
    // doivent pas changer de forme au passage.
    expect(sujetRecap([lead("plus_1m")])).toBe("1 nouveau lead — 1 au-dessus de 1 M€");
    expect(sujetRecap([lead("500k_1m")])).toBe("1 nouveau lead");
  });

  it("un nom vide ou en blancs ne produit pas de préfixe orphelin", () => {
    expect(sujetRecap([lead("500k_1m")], "   ")).toBe("1 nouveau lead");
    expect(sujetRecap([lead("500k_1m")], null)).toBe("1 nouveau lead");
  });
});

describe("le message porte le bien", () => {
  const commun = { maintenant: new Date("2026-11-06T12:00:00Z"), depuis: new Date("2026-11-06T07:30:00Z") };

  it("le nom apparaît en tête du message", () => {
    const r = construireRecap({ leads: [lead("plus_1m")], dormants: DORMANTS, ...commun, bien: "Les Airelles aux 2 Alpes" });
    expect(r.envoyer).toBe(true);
    expect(r.html).toContain("Les Airelles aux 2 Alpes");
  });

  it("sans bien, le message ne gagne aucun chapeau", () => {
    const avec = construireRecap({ leads: [lead("plus_1m")], dormants: DORMANTS, ...commun, bien: "X" });
    const sans = construireRecap({ leads: [lead("plus_1m")], dormants: DORMANTS, ...commun });
    expect(sans.html).not.toContain("text-transform:uppercase");
    expect(avec.html.length).toBeGreaterThan(sans.html.length);
  });

  it("un créneau sans lead n'envoie rien, bien nommé ou pas", () => {
    expect(construireRecap({ leads: [], dormants: DORMANTS, ...commun, bien: "Les Airelles" }).envoyer).toBe(false);
  });
});

describe("la route — les invariants qu'on ne veut plus jamais perdre", () => {
  const route = readFileSync("src/app/api/recap-leads/route.ts", "utf8");

  it("les destinataires viennent de la base, jamais d'une liste écrite ici", () => {
    /*
     * LE DÉFAUT D'ORIGINE. La liste vivait dans Make, donc confier un bien à
     * quelqu'un ne suffisait pas : il fallait penser à rouvrir un scénario.
     * Personne n'y a pensé pour Édouard.
     */
    expect(route).toContain("crm_recap_recipients");
    // Aucune adresse e-mail en dur : c'est ce qui fait retomber dans le piège.
    expect(route).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it("un bien sans destinataire n'envoie pas", () => {
    // Sinon le scénario échoue sur un faux problème : « pas de destinataire ».
    expect(route).toContain("adresses.length > 0");
  });

  it("les liens « en retard » et « sans action » portent le filtre de bien", () => {
    // Un chiffre qui ouvre une liste dont la personne ne peut rien voir est
    // pire qu'un chiffre absent.
    expect(route).toContain("projets=${encodeURIComponent(propertyId)}");
  });

  it("les compteurs d'un bien ne comptent QUE ce bien", () => {
    expect(route).toContain("r.properties.some((b) => b.id === propertyId)");
  });

  it("les champs globaux restent servis pendant la bascule de Make", () => {
    for (const champ of ["envoyer: recap.envoyer", "sujet: recap.sujet", "html: recap.html"]) {
      expect(route, champ).toContain(champ);
    }
    expect(route).toContain("recaps,");
  });
});
