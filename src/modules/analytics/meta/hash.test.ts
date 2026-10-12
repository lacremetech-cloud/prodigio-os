import { describe, expect, it } from "vitest";
import { buildFbc, hashCountry, hashEmail, hashName, hashPhone } from "./hash";

/**
 * Ces empreintes sont la seule chose que Meta voit. Une normalisation fautive
 * n'échoue jamais bruyamment : l'événement part, et ne correspond à personne.
 * D'où des attentes sur l'égalité des empreintes plutôt que sur leur valeur.
 */

describe("hashEmail", () => {
  it("ignore la casse et les espaces", () => {
    expect(hashEmail("  Camille.Durand@Example.TEST ")).toBe(
      hashEmail("camille.durand@example.test"),
    );
  });

  it("écarte ce qui n'est pas une adresse", () => {
    expect(hashEmail("")).toBeNull();
    expect(hashEmail("camille")).toBeNull();
    expect(hashEmail(null)).toBeNull();
  });

  it("produit bien une empreinte SHA-256 et non la valeur", () => {
    const h = hashEmail("camille@example.test");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("camille");
  });
});

describe("hashPhone", () => {
  it("ramène toute écriture d'un même numéro à la même empreinte", () => {
    const attendu = hashPhone("+33612345678");
    expect(hashPhone("+33 6 12 34 56 78")).toBe(attendu);
    expect(hashPhone("0033612345678")).toBe(attendu);
  });

  it("refuse un numéro national, que Meta ne saurait rattacher", () => {
    // « 0612345678 » devient « 612345678 » : neuf chiffres, aucun indicatif.
    expect(hashPhone("0612345678")).toBeNull();
  });

  it("refuse ce qui n'a pas la longueur d'un numéro", () => {
    expect(hashPhone("1234")).toBeNull();
    expect(hashPhone("+331234567890123456")).toBeNull();
    expect(hashPhone(null)).toBeNull();
  });
});

describe("hashName", () => {
  it("ignore casse, espaces et ponctuation", () => {
    expect(hashName(" Jean-Charles ")).toBe(hashName("jeancharles"));
    expect(hashName("O'Brien")).toBe(hashName("obrien"));
  });

  it("conserve les accents, qui distinguent deux noms", () => {
    expect(hashName("Hélène")).not.toBe(hashName("Helene"));
  });
});

describe("hashCountry", () => {
  it("accepte un code ISO à deux lettres, quelle que soit la casse", () => {
    expect(hashCountry("FR")).toBe(hashCountry("fr"));
  });

  it("refuse un nom de pays écrit en toutes lettres", () => {
    expect(hashCountry("France")).toBeNull();
  });
});

describe("buildFbc", () => {
  it("reconstitue le cookie au format attendu par Meta", () => {
    const fbc = buildFbc("IwAR123", new Date("2026-10-12T10:00:00.000Z"));
    expect(fbc).toBe(`fb.1.${Date.parse("2026-10-12T10:00:00.000Z")}.IwAR123`);
  });

  it("sans fbclid, il n'y a rien à reconstituer", () => {
    expect(buildFbc(null, new Date())).toBeNull();
    expect(buildFbc("   ", new Date())).toBeNull();
  });

  it("retombe sur l'instant présent si la date est inexploitable", () => {
    expect(buildFbc("IwAR123", "pas une date")).toMatch(/^fb\.1\.\d+\.IwAR123$/);
  });
});
