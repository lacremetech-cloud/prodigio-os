import { describe, expect, it } from "vitest";
import {
  PREVIEW_WIDTHS,
  checkVariables,
  previewTemplate,
  previewViewportLabels,
  type TemplateDraft,
} from "./preview";
import { SYNTHETIC_RECIPIENTS } from "./fixtures";

const DRAFT: TemplateDraft = {
  subject: "Bonjour {{prenom}}",
  body: "Votre bien à {{ville}} est enregistré.",
  bodyFormat: "markdown",
  allowedVariables: ["prenom", "ville", "nom"],
};

describe("contrôle des variables", () => {
  it("distingue utilisées, non déclarées, manquantes et déclarées inutilisées", () => {
    const check = checkVariables(DRAFT, { prenom: "Camille" });
    expect(check.used).toEqual(["prenom", "ville"]);
    expect(check.undeclared).toEqual([]);
    expect(check.missing).toEqual(["ville"]);
    expect(check.unused).toEqual(["nom"]);
    expect(check.ok).toBe(false);
  });

  it("signale une variable employée mais non déclarée", () => {
    const check = checkVariables(
      { ...DRAFT, body: "Bonjour {{surnom}}" },
      { prenom: "Camille", surnom: "Cam" },
    );
    expect(check.undeclared).toEqual(["surnom"]);
    expect(check.ok).toBe(false);
  });

  it("valide un modèle complet", () => {
    const check = checkVariables(DRAFT, { prenom: "Camille", ville: "Ville-Exemple" });
    expect(check.ok).toBe(true);
    expect(check.missing).toEqual([]);
    expect(check.undeclared).toEqual([]);
  });
});

describe("prévisualisation", () => {
  it("refuse un rendu partiel et NOMME la variable manquante", () => {
    const result = previewTemplate(DRAFT, { prenom: "Camille" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/\{\{ville\}\}/);
      expect(result.error).toMatch(/Aucun rendu partiel/i);
    }
  });

  it("refuse une variable non déclarée, avec une consigne claire", () => {
    const result = previewTemplate({ ...DRAFT, body: "{{surnom}}" }, { surnom: "Cam" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Déclarez-la ou retirez-la/i);
  });

  it("rend le contenu quand toutes les variables sont fournies", () => {
    const result = previewTemplate(DRAFT, { prenom: "Camille", ville: "Ville-Exemple" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subject).toBe("Bonjour Camille");
      expect(result.body).toContain("Ville-Exemple");
    }
  });

  it("échappe les valeurs en HTML : une donnée tierce n'injecte aucune balise", () => {
    const result = previewTemplate(
      { subject: null, body: "{{prenom}}", bodyFormat: "html", allowedVariables: ["prenom"] },
      { prenom: "<script>alert(1)</script>" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).not.toContain("<script>");
      expect(result.body).toContain("&lt;script&gt;");
    }
  });

  it("fonctionne avec le jeu de données FICTIF, jamais avec un contact réel", () => {
    const recipient = SYNTHETIC_RECIPIENTS[0]!;
    const result = previewTemplate(DRAFT, recipient.variables);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.subject).toContain(recipient.variables.prenom);
  });

  it("propose deux largeurs de rendu distinctes, ordinateur et mobile", () => {
    expect(PREVIEW_WIDTHS.desktop).toBeGreaterThan(PREVIEW_WIDTHS.mobile);
    expect(previewViewportLabels.desktop).toBeTruthy();
    expect(previewViewportLabels.mobile).toBeTruthy();
  });
});
