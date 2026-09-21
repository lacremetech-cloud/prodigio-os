import { describe, expect, it } from "vitest";
import {
  parseBrief,
  parseEuroAmount,
  parseFrenchNumber,
  parseSurface,
} from "./parse";

function field(analysis: ReturnType<typeof parseBrief>, key: string) {
  return analysis.recognised.find((item) => item.key === key);
}

describe("parseFrenchNumber", () => {
  it("lit les séparateurs de milliers espace, point et apostrophe", () => {
    expect(parseFrenchNumber("1 490 000")).toBe(1_490_000);
    expect(parseFrenchNumber("1.490.000")).toBe(1_490_000);
    expect(parseFrenchNumber("1'490'000")).toBe(1_490_000);
    expect(parseFrenchNumber("1490000")).toBe(1_490_000);
  });

  it("distingue un décimal d'un millier", () => {
    expect(parseFrenchNumber("1,49")).toBe(1.49);
    expect(parseFrenchNumber("1.49")).toBe(1.49);
    expect(parseFrenchNumber("1.490")).toBe(1490);
  });

  it("refuse ce qui n'est pas un nombre", () => {
    expect(parseFrenchNumber("à définir")).toBeNull();
    expect(parseFrenchNumber("")).toBeNull();
  });
});

describe("parseEuroAmount", () => {
  it("lit les montants écrits avec espaces, points ou symbole euro", () => {
    expect(parseEuroAmount("1 490 000 €")).toBe(1_490_000);
    expect(parseEuroAmount("1.490.000€")).toBe(1_490_000);
    expect(parseEuroAmount("1490000 EUR")).toBe(1_490_000);
    expect(parseEuroAmount("1 490 000 euros")).toBe(1_490_000);
  });

  it("lit les abréviations de magnitude", () => {
    expect(parseEuroAmount("1,49 M€")).toBe(1_490_000);
    expect(parseEuroAmount("1.49 million d'euros")).toBe(1_490_000);
    expect(parseEuroAmount("890 k€")).toBe(890_000);
  });

  it("refuse un montant absent ou nul", () => {
    expect(parseEuroAmount("prix à définir")).toBeNull();
    expect(parseEuroAmount("0 €")).toBeNull();
  });
});

describe("parseSurface", () => {
  it("accepte m², m2 et les formulations équivalentes", () => {
    expect(parseSurface("160 m²")).toBe(160);
    expect(parseSurface("160 m2")).toBe(160);
    expect(parseSurface("160m²")).toBe(160);
    expect(parseSurface("160 mètres carrés")).toBe(160);
    expect(parseSurface("1 200 m2")).toBe(1200);
  });
});

describe("parseBrief — brief en paires clé/valeur", () => {
  const analysis = parseBrief(
    [
      "Nom : Villa Jean Jaurès",
      "Adresse : 20 avenue Jean Jaurès",
      "Ville : Cassis",
      "Code postal : 13260",
      "Surface : 160 m²",
      "Parcelle : 400 m2",
      "Pièces : 5",
      "Chambres : 4",
      "Prix : 1 490 000 €",
      "Organisation : JCA",
      "Année de rénovation : 2026",
    ].join("\n"),
  );

  it("reconnaît l'ensemble des champs du brief", () => {
    expect(analysis.draft.projectName).toBe("Villa Jean Jaurès");
    expect(analysis.draft.addressLine).toBe("20 avenue Jean Jaurès");
    expect(analysis.draft.locationCity).toBe("Cassis");
    expect(analysis.draft.locationPostalCode).toBe("13260");
    expect(analysis.draft.surfaceM2).toBe(160);
    expect(analysis.draft.landM2).toBe(400);
    expect(analysis.draft.rooms).toBe(5);
    expect(analysis.draft.bedrooms).toBe(4);
    expect(analysis.draft.priceEur).toBe(1_490_000);
    expect(analysis.draft.organizationName).toBe("JCA");
  });

  it("n'enregistre JAMAIS une année de rénovation comme année de construction", () => {
    expect(analysis.draft.renovationYear).toBe(2026);
    expect(analysis.draft.yearBuilt).toBeNull();
    expect(analysis.missing.map((item) => item.key)).toContain("yearBuilt");
  });

  it("ne signale ni contradiction ni passage incompris", () => {
    expect(analysis.contradictions).toEqual([]);
    expect(analysis.unrecognised).toEqual([]);
  });
});

describe("parseBrief — brief rédigé en paragraphes", () => {
  const analysis = parseBrief(
    "Villa Verdun, située 17 avenue de Verdun à 13260 Cassis. " +
      "La maison développe 210 m² habitables sur un terrain de 850 m², " +
      "avec 6 pièces dont 4 chambres. Elle dispose d'une piscine et d'une vue mer. " +
      "Prix affiché 1 890 000 €. Construite en 1974, rénovée en 2021.",
  );

  it("extrait les informations de la prose", () => {
    expect(analysis.draft.locationPostalCode).toBe("13260");
    expect(analysis.draft.locationCity).toBe("Cassis");
    expect(analysis.draft.surfaceM2).toBe(210);
    expect(analysis.draft.landM2).toBe(850);
    expect(analysis.draft.rooms).toBe(6);
    expect(analysis.draft.bedrooms).toBe(4);
    expect(analysis.draft.priceEur).toBe(1_890_000);
    expect(analysis.draft.addressLine).toContain("17 avenue de Verdun");
  });

  it("distingue l'année de construction de l'année de rénovation", () => {
    expect(analysis.draft.yearBuilt).toBe(1974);
    expect(analysis.draft.renovationYear).toBe(2021);
  });

  it("relève les caractéristiques courantes", () => {
    expect(analysis.draft.features).toEqual(expect.arrayContaining(["piscine", "vue mer"]));
  });
});

describe("parseBrief — contradictions", () => {
  const analysis = parseBrief(["Prix : 1 490 000 €", "Prix de vente : 1 250 000 €"].join("\n"));

  it("signale la contradiction sans trancher", () => {
    expect(analysis.contradictions).toHaveLength(1);
    expect(analysis.contradictions[0]?.key).toBe("priceEur");
    expect(analysis.contradictions[0]?.values).toHaveLength(2);
    expect(analysis.draft.priceEur).toBeNull();
    expect(field(analysis, "priceEur")).toBeUndefined();
  });

  it("ne considère pas deux écritures d'une même valeur comme une contradiction", () => {
    const same = parseBrief(["Prix : 1 490 000 €", "Prix de vente : 1.490.000 EUR"].join("\n"));
    expect(same.contradictions).toEqual([]);
    expect(same.draft.priceEur).toBe(1_490_000);
  });
});

describe("parseBrief — passages incompris", () => {
  it("restitue tel quel ce qu'aucune règle n'interprète", () => {
    const analysis = parseBrief(
      ["Nom : Villa Test", "Exposition cadastrale : lot 42 section AB", "Blah blah blah"].join("\n"),
    );
    expect(analysis.unrecognised).toContain("Exposition cadastrale : lot 42 section AB");
    expect(analysis.unrecognised).toContain("Blah blah blah");
  });

  it("n'invente pas de valeur pour une étiquette connue mais illisible", () => {
    const analysis = parseBrief("Prix : à définir");
    expect(analysis.draft.priceEur).toBeNull();
    expect(analysis.unrecognised).toContain("Prix : à définir");
  });
});

describe("parseBrief — liens et champs manquants", () => {
  it("collecte les liens utiles sans les dédupliquer à tort", () => {
    const analysis = parseBrief(
      ["Lien : https://villa-jeanjaures-cassis.vercel.app/brochure/", "Site : https://example.test"].join(
        "\n",
      ),
    );
    expect(analysis.draft.links).toEqual([
      "https://villa-jeanjaures-cassis.vercel.app/brochure/",
      "https://example.test",
    ]);
  });

  it("marque les champs indispensables absents", () => {
    const analysis = parseBrief("");
    const required = analysis.missing.filter((item) => item.required).map((item) => item.key);
    expect(required).toEqual(expect.arrayContaining(["projectName", "organizationName"]));
    expect(analysis.recognised).toEqual([]);
  });
});
