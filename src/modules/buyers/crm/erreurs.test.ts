import { describe, expect, it, vi } from "vitest";

import { messageUtilisateur } from "./erreurs";

describe("les messages d'erreur montrés au commercial", () => {
  it("ne laisse JAMAIS passer le jargon de PostgreSQL", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const brut = "there is no unique or exclusion constraint matching the ON CONFLICT specification";
    for (const code of [undefined, "42P10", "42703", "23505"]) {
      const m = messageUtilisateur(code, brut);
      expect(m).not.toContain("constraint");
      expect(m).not.toContain("ON CONFLICT");
      expect(m).toMatch(/[éèêàù]/); // une vraie phrase française
    }
  });

  it("laisse passer nos propres messages, écrits pour l'écran", () => {
    expect(messageUtilisateur("42501", "droits insuffisants sur ce dossier acquereur")).toBe(
      "droits insuffisants sur ce dossier acquereur",
    );
    expect(messageUtilisateur("22023", "utilisateur cible non membre actif")).toBe(
      "utilisateur cible non membre actif",
    );
  });

  it("dit quoi faire quand la session a expiré", () => {
    expect(messageUtilisateur("28000", "")).toBe("Session expirée. Reconnectez-vous.");
  });

  it("ne rend pas une phrase vide quand la base n'en donne pas", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const code of ["42501", "22023", undefined]) {
      expect(messageUtilisateur(code, "").trim().length).toBeGreaterThan(10);
    }
  });

  it("journalise le code non traduit, pour qu'une panne reste diagnosticable", () => {
    const espion = vi.spyOn(console, "error").mockImplementation(() => {});
    messageUtilisateur("42P10", "boom");
    expect(espion).toHaveBeenCalledWith(
      "crm acquereurs : erreur base non traduite",
      expect.objectContaining({ code: "42P10" }),
    );
  });
});
