import { describe, expect, it } from "vitest";
import { buildTouch, hasSignal, mergeAttribution } from "./attribution";

const ISO = "2026-07-29T10:00:00.000Z";

describe("buildTouch", () => {
  it("extrait les UTM et identifiants de clic d'une URL", () => {
    const url =
      "https://prodigio.example/proprietaire?utm_source=meta&utm_medium=cpc" +
      "&utm_campaign=chalets&fbclid=abc123";
    const touch = buildTouch(url, "https://facebook.com/", ISO);

    expect(touch.utm_source).toBe("meta");
    expect(touch.utm_medium).toBe("cpc");
    expect(touch.utm_campaign).toBe("chalets");
    expect(touch.fbclid).toBe("abc123");
    expect(touch.referrer).toBe("https://facebook.com/");
    expect(touch.at).toBe(ISO);
  });

  it("gère une URL invalide sans lever d'erreur", () => {
    const touch = buildTouch("pas une url", null, ISO);
    expect(touch.url).toBeNull();
    expect(touch.utm_source).toBeNull();
    expect(touch.referrer).toBeNull();
  });
});

describe("hasSignal", () => {
  it("détecte un signal d'attribution", () => {
    const touch = buildTouch(
      "https://prodigio.example/?utm_source=meta",
      null,
      ISO,
    );
    expect(hasSignal(touch)).toBe(true);
  });

  it("renvoie false en l'absence de signal", () => {
    const touch = buildTouch("https://prodigio.example/proprietaire", null, ISO);
    expect(hasSignal(touch)).toBe(false);
  });
});

describe("mergeAttribution", () => {
  it("fixe le premier contact une seule fois et actualise le dernier", () => {
    const first = buildTouch(
      "https://prodigio.example/?utm_source=meta",
      null,
      "2026-07-01T00:00:00.000Z",
    );
    const later = buildTouch(
      "https://prodigio.example/?utm_source=google",
      null,
      "2026-07-10T00:00:00.000Z",
    );

    const afterFirst = mergeAttribution(null, first);
    expect(afterFirst.first?.utm_source).toBe("meta");
    expect(afterFirst.last?.utm_source).toBe("meta");

    const afterSecond = mergeAttribution(afterFirst, later);
    expect(afterSecond.first?.utm_source).toBe("meta"); // inchangé
    expect(afterSecond.last?.utm_source).toBe("google"); // actualisé
  });

  it("n'enregistre pas de premier contact sans signal", () => {
    const noSignal = buildTouch("https://prodigio.example/proprietaire", null, ISO);
    const merged = mergeAttribution(null, noSignal);
    expect(merged.first).toBeNull();
    expect(merged.last).not.toBeNull();
  });
});

/**
 * Regression : une demande venue d'une publicite Instagram a ete enregistree
 * avec toutes ses colonnes d'attribution a NULL, alors que `utm_campaign` et
 * `fbclid` figuraient bien dans l'adresse de la page.
 *
 * La cause : l'attribution n'etait relue QUE dans le stockage de session. Or
 * le formulaire vit dans un cadre d'une autre origine, et plusieurs
 * navigateurs refusent ou cloisonnent le stockage d'un cadre tiers. L'ecriture
 * echoue en silence, la relecture rend vide, la campagne est perdue.
 *
 * Le depot compose desormais le stockage AVEC l'adresse courante. Ces deux
 * tests fixent ce comportement : stockage vide, la campagne passe quand meme ;
 * stockage rempli, le premier contact est preserve.
 */
describe("attribution quand le stockage de session est indisponible", () => {
  const ADRESSE =
    "https://go.prodigio.fr/bien/villa-verdun/interet" +
    "?fbclid=PAZTEST123&utm_source=ig&utm_medium=paid" +
    "&utm_campaign=120252600271810565&utm_content=120252600515880565";

  it("retient la campagne depuis l'adresse, sans aucun stockage", () => {
    const courante = buildTouch(ADRESSE, null, "2026-10-14T00:49:00.000Z");
    const fusion = mergeAttribution(null, courante);

    expect(fusion.last?.utm_campaign).toBe("120252600271810565");
    expect(fusion.last?.utm_content).toBe("120252600515880565");
    expect(fusion.last?.utm_source).toBe("ig");
    expect(fusion.last?.utm_medium).toBe("paid");
    expect(fusion.last?.fbclid).toBe("PAZTEST123");
    // Sans stockage, la visite publicitaire est AUSSI le premier contact.
    expect(fusion.first?.utm_campaign).toBe("120252600271810565");
  });

  it("preserve le premier contact quand le stockage a survecu", () => {
    const premier = buildTouch(
      "https://villa-verdun-cassis.vercel.app/?utm_campaign=CAMPAGNE_INITIALE",
      null,
      "2026-10-13T08:00:00.000Z",
    );
    const courante = buildTouch(ADRESSE, null, "2026-10-14T00:49:00.000Z");
    const fusion = mergeAttribution({ first: premier, last: premier }, courante);

    expect(fusion.first?.utm_campaign).toBe("CAMPAGNE_INITIALE");
    expect(fusion.last?.utm_campaign).toBe("120252600271810565");
  });
});
