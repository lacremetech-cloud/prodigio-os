import { describe, expect, it } from "vitest";
import * as copy from "./copy";

/** Toutes les chaînes affichées par la landing — les noms de champs exclus. */
function chaines(valeur: unknown, sortie: string[] = []): string[] {
  if (typeof valeur === "string") sortie.push(valeur);
  else if (Array.isArray(valeur)) for (const v of valeur) chaines(v, sortie);
  else if (valeur && typeof valeur === "object")
    for (const v of Object.values(valeur)) chaines(v, sortie);
  return sortie;
}

const TEXTE = chaines(copy).join(" \u2014 ");

describe("Copy de la landing propriétaire", () => {
  it("ne parle jamais au propriétaire en jargon marketing", () => {
    // Le propriétaire doit penser « ils trouvent mon acheteur », pas « ils ont
    // une machine publicitaire ». Chaque notion technique se traduit en
    // bénéfice immobilier.
    const jargon = [
      /\bavatar/i,
      /\bleads?\b/i,
      /\bfunnel/i,
      /tunnel de vente/i,
      /meta ads/i,
      /\bciblage/i,
      /retargeting/i,
      /\bscraping/i,
      /\bROAS\b/,
      /\bCPM\b|\bCPC\b/,
      /acquisition digitale/i,
    ];
    for (const motif of jargon) {
      expect(TEXTE, `jargon détecté : ${motif}`).not.toMatch(motif);
    }
  });

  it("ne caricature jamais la profession immobilière", () => {
    expect(TEXTE).not.toMatch(/dépassé|obsolèt|ne font rien|ne fonctionne plus|incompéten/i);
  });

  it("ne promet ni délai, ni prix, ni performance garantis", () => {
    expect(TEXTE).not.toMatch(/vendu en \d|vendons votre bien en \d|\bassuré de vendre\b/i);
    // « garantie » n'est admis que sous une forme négative (avertissement).
    for (const phrase of chaines(copy)) {
      if (!/garanti/i.test(phrase)) continue;
      expect(phrase, `promesse de garantie : ${phrase}`).toMatch(
        /ne constituent? pas une garantie|aucune garantie|sans garantie/i,
      );
    }
  });

  it("ne chiffre aucune condition économique (paramètres contractuels versionnés)", () => {
    // Ni pourcentage de partage, ni honoraires : ces conditions vivent dans les
    // règles économiques versionnées, jamais dans une page publique.
    expect(TEXTE).not.toMatch(/\d+\s*%/);
    expect(TEXTE).not.toMatch(/honoraires de \d/i);
  });

  it("accompagne toute statistique d'audience d'une mention de source", () => {
    expect(copy.audience.sourceNote).toMatch(/source/i);
  });

  it("présente les interfaces illustratives comme telles", () => {
    expect(copy.transparence.disclaimer).toMatch(/illustration/i);
    expect(copy.audience.adMock.note).toMatch(/illustration/i);
    expect(copy.caseStudy.disclaimer).toMatch(/ne constituent pas une garantie/i);
  });
});
