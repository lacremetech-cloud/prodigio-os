/**
 * Chiffrement au repos des jetons Google (access + refresh).
 *
 * Algorithme : **AES-256-GCM** (chiffrement authentifié). Chaque valeur est
 * chiffrée avec un IV aléatoire de 12 octets ; le tag d'authentification (16 o)
 * garantit l'intégrité. Format de sortie (texte, sûr à stocker en base) :
 *
 *     v1:<ivBase64>:<tagBase64>:<ciphertextBase64>
 *
 * La clé provient de `CALENDAR_TOKEN_ENCRYPTION_KEY` (32 octets encodés base64,
 * générés par `openssl rand -base64 32`) : **variable serveur Vercel**, jamais
 * `NEXT_PUBLIC_`. Les jetons ne sont jamais stockés ni journalisés en clair.
 *
 * Les fonctions de bas niveau prennent la clé en paramètre (pures, testables) ;
 * les fonctions publiques `encryptToken` / `decryptToken` lisent la clé depuis
 * l'environnement.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/config";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const PREFIX = "v1";

/** Décode et valide la clé (32 octets). Lève si absente / mal dimensionnée. */
export function loadEncryptionKey(rawBase64: string | undefined): Buffer {
  if (!rawBase64) {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY absente : chiffrement indisponible.");
  }
  let key: Buffer;
  try {
    key = Buffer.from(rawBase64, "base64");
  } catch {
    throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY invalide (base64 attendu).");
  }
  if (key.length !== 32) {
    throw new Error(
      "CALENDAR_TOKEN_ENCRYPTION_KEY doit faire 32 octets (openssl rand -base64 32).",
    );
  }
  return key;
}

/** Chiffre `plaintext` avec la clé fournie. Renvoie le format « v1:iv:tag:ct ». */
export function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ct.toString("base64"),
  ].join(":");
}

/** Déchiffre un jeton « v1:iv:tag:ct » avec la clé fournie. Lève si altéré. */
export function decryptWithKey(token: string, key: Buffer): string {
  const [prefix, ivB64, tagB64, ctB64] = token.split(":");
  if (!prefix || !ivB64 || !tagB64 || !ctB64 || prefix !== PREFIX) {
    throw new Error("Jeton chiffré illisible (format inattendu).");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new Error("Jeton chiffré illisible (IV/tag invalides).");
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Chiffre une valeur en lisant la clé depuis l'environnement (usage serveur). */
export function encryptToken(plaintext: string): string {
  return encryptWithKey(plaintext, loadEncryptionKey(env.CALENDAR_TOKEN_ENCRYPTION_KEY));
}

/** Déchiffre une valeur en lisant la clé depuis l'environnement (usage serveur). */
export function decryptToken(token: string): string {
  return decryptWithKey(token, loadEncryptionKey(env.CALENDAR_TOKEN_ENCRYPTION_KEY));
}

/**
 * Comparaison à temps constant de deux chaînes (anti timing-attack). Exposée
 * pour la validation du paramètre `state` OAuth.
 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
