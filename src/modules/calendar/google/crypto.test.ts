import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptWithKey,
  encryptWithKey,
  loadEncryptionKey,
  safeEqual,
} from "./crypto";

const KEY = randomBytes(32);

describe("chiffrement des jetons (AES-256-GCM)", () => {
  it("round-trip : déchiffrer redonne le texte d'origine", () => {
    const secret = "ya29.a0AfH-un-access-token-exemple";
    const enc = encryptWithKey(secret, KEY);
    expect(enc).not.toContain(secret); // jamais en clair
    expect(enc.startsWith("v1:")).toBe(true);
    expect(decryptWithKey(enc, KEY)).toBe(secret);
  });

  it("deux chiffrements du même texte diffèrent (IV aléatoire)", () => {
    const a = encryptWithKey("meme-valeur", KEY);
    const b = encryptWithKey("meme-valeur", KEY);
    expect(a).not.toBe(b);
    expect(decryptWithKey(a, KEY)).toBe("meme-valeur");
    expect(decryptWithKey(b, KEY)).toBe("meme-valeur");
  });

  it("un texte chiffré altéré est rejeté (intégrité GCM)", () => {
    const enc = encryptWithKey("refresh-token", KEY);
    const parts = enc.split(":");
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${Buffer.from("xxxx").toString("base64")}`;
    expect(() => decryptWithKey(tampered, KEY)).toThrow();
  });

  it("une mauvaise clé ne peut pas déchiffrer", () => {
    const enc = encryptWithKey("valeur", KEY);
    expect(() => decryptWithKey(enc, randomBytes(32))).toThrow();
  });

  it("un format inattendu est rejeté proprement", () => {
    expect(() => decryptWithKey("pas-un-jeton", KEY)).toThrow(/illisible/);
    expect(() => decryptWithKey("v2:a:b:c", KEY)).toThrow(/illisible/);
  });

  it("loadEncryptionKey exige 32 octets base64", () => {
    expect(() => loadEncryptionKey(undefined)).toThrow();
    expect(() => loadEncryptionKey(Buffer.alloc(16).toString("base64"))).toThrow(/32 octets/);
    expect(loadEncryptionKey(KEY.toString("base64")).length).toBe(32);
  });

  it("safeEqual compare à longueur/contenu", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
