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
