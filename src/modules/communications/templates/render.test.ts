import { describe, expect, it } from "vitest";
import { extractVariables, renderErrorLabel, renderTemplate } from "./render";

/**
 * Le rendu est un point de sécurité : un modèle mal rendu ne doit JAMAIS partir.
 */

describe("extractVariables", () => {
  it("relève les variables sans doublon, indépendamment de la casse et des espaces", () => {
    expect(extractVariables("Bonjour {{prenom}}, {{ PRENOM }} — {{ville}}").sort()).toEqual([
      "prenom",
      "ville",
    ]);
  });

  it("ignore ce qui n'est pas un jeton de variable", () => {
    expect(extractVariables("Prix : { 100 } et {{ }} et {{1abc}}")).toEqual([]);
  });
});

describe("renderTemplate", () => {
  const base = {
    bodyFormat: "markdown" as const,
    allowedVariables: ["prenom", "ville"],
  };

  it("substitue les variables déclarées et fournies", () => {
    const res = renderTemplate({
      ...base,
      subject: "Votre bien à {{ville}}",
      body: "Bonjour {{prenom}}, merci.",
      values: { prenom: "Claire", ville: "Annecy" },
    });
    expect(res).toEqual({ ok: true, subject: "Votre bien à Annecy", body: "Bonjour Claire, merci." });
  });

  it("REFUSE une variable non déclarée par le modèle", () => {
    const res = renderTemplate({
      ...base,
      body: "Bonjour {{prenom}}, votre prix est {{prix_secret}}.",
      values: { prenom: "Claire", prix_secret: "1 200 000 €" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("variable_non_declaree");
      expect(res.variables).toEqual(["prix_secret"]);
    }
  });

  it("REFUSE plutôt que d'envoyer un contenu partiellement rendu", () => {
    const res = renderTemplate({
      ...base,
      body: "Bonjour {{prenom}}, votre bien à {{ville}}.",
      values: { prenom: "Claire" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("variable_manquante");
      expect(res.variables).toEqual(["ville"]);
    }
  });

  it("traite une valeur vide comme manquante", () => {
    const res = renderTemplate({
      ...base,
      allowedVariables: ["prenom"],
      body: "Bonjour {{prenom}}.",
      values: { prenom: "" },
    });
    expect(res.ok).toBe(false);
  });

  it("échappe les valeurs en HTML : une donnée tierce ne peut pas injecter de balise", () => {
    const res = renderTemplate({
      bodyFormat: "html",
      allowedVariables: ["prenom"],
      body: "<p>Bonjour {{prenom}}</p>",
      values: { prenom: '<script>alert("x")</script>' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body).not.toContain("<script>");
      expect(res.body).toContain("&lt;script&gt;");
    }
  });

  it("n'échappe pas en markdown (le contenu n'est pas interprété comme du HTML)", () => {
    const res = renderTemplate({
      bodyFormat: "markdown",
      allowedVariables: ["ville"],
      body: "Ville : {{ville}}",
      values: { ville: "Saint-Jean-d'Arves" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.body).toBe("Ville : Saint-Jean-d'Arves");
  });

  it("rend un sujet nul lorsqu'aucun sujet n'est fourni (cas SMS)", () => {
    const res = renderTemplate({
      bodyFormat: "texte",
      allowedVariables: [],
      subject: null,
      body: "Rappel de votre rendez-vous.",
      values: {},
    });
    expect(res).toEqual({ ok: true, subject: null, body: "Rappel de votre rendez-vous." });
  });

  it("produit un message d'erreur lisible", () => {
    const res = renderTemplate({
      ...base,
      body: "{{inconnue}}",
      values: {},
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(renderErrorLabel(res)).toContain("{{inconnue}}");
  });
});
