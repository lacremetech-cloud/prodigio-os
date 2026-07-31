import { describe, expect, it } from "vitest";
import {
  buildStoragePath,
  MAX_DOCUMENT_BYTES,
  sanitizeFileName,
  validateDocument,
} from "./storage";

describe("validateDocument", () => {
  it("accepte un PDF valide et normalise le nom", () => {
    const res = validateDocument({
      mime: "application/pdf",
      size: 1024,
      fileName: "Mandat signé.pdf",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ext).toBe("pdf");
      expect(res.fileName).toContain("Mandat");
    }
  });

  it("accepte JPEG et PNG", () => {
    expect(validateDocument({ mime: "image/jpeg", size: 10, fileName: "a.jpg" }).ok).toBe(true);
    expect(validateDocument({ mime: "image/png", size: 10, fileName: "a.png" }).ok).toBe(true);
  });

  it("refuse un type non autorisé", () => {
    const res = validateDocument({ mime: "application/zip", size: 10, fileName: "a.zip" });
    expect(res.ok).toBe(false);
  });

  it("refuse un fichier vide", () => {
    expect(validateDocument({ mime: "application/pdf", size: 0, fileName: "a.pdf" }).ok).toBe(false);
  });

  it("refuse un fichier trop volumineux", () => {
    const res = validateDocument({
      mime: "application/pdf",
      size: MAX_DOCUMENT_BYTES + 1,
      fileName: "a.pdf",
    });
    expect(res.ok).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("retire les chemins et neutralise les caractères parasites", () => {
    const name = sanitizeFileName("../../secret/../mandat  final.pdf", "pdf");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });

  it("fournit un nom de repli si vide", () => {
    expect(sanitizeFileName("", "pdf")).toBe("document.pdf");
  });

  it("borne la longueur", () => {
    expect(sanitizeFileName("a".repeat(500), "pdf").length).toBeLessThanOrEqual(200);
  });
});

describe("buildStoragePath", () => {
  it("préfixe par l'opportunité et sans PII (uuid + extension)", () => {
    const oppId = "11111111-1111-1111-1111-111111111111";
    const path = buildStoragePath(oppId, "pdf");
    expect(path).toMatch(
      new RegExp(`^${oppId}/[0-9a-f-]{36}\\.pdf$`),
    );
  });

  it("génère un chemin différent à chaque appel", () => {
    const oppId = "22222222-2222-2222-2222-222222222222";
    expect(buildStoragePath(oppId, "png")).not.toBe(buildStoragePath(oppId, "png"));
  });
});
