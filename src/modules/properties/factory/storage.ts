import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Couche Storage PRIVÉE de la Fabrique de biens (médiathèque + documents).
 *
 * Le bucket `property-assets` est **privé** (aucun accès public, aucune politique
 * d'accès direct). Le téléversement, la consultation et la suppression du FICHIER
 * passent EXCLUSIVEMENT par le rôle de service (client admin) côté serveur, APRÈS
 * un contrôle de rôle effectué par l'action serveur et re-vérifié en base par les
 * fonctions `crm_property_*`. On ne renvoie au navigateur qu'une **URL signée
 * courte** ; elle n'est JAMAIS stockée durablement en base.
 *
 * Aucune PII dans le chemin de stockage : `{propertyId}/{scope}/{uuid}.{ext}`.
 * Le nom d'origine n'est utilisé que pour l'AFFICHAGE (assaini), jamais dans le
 * chemin réel.
 */

export const PROPERTY_ASSETS_BUCKET = "property-assets";

/** Types de médias autorisés (miroir de `crm_property_register_media`). */
export const ALLOWED_MEDIA_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
};

/** Types de documents autorisés (miroir de `crm_property_register_document`). */
export const ALLOWED_DOCUMENT_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Poids maximal d'un média (100 Mo — vidéos légères) et d'un document (25 Mo). */
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** Durée de vie d'une URL signée : courte par conception (60 s). */
export const SIGNED_URL_TTL_SECONDS = 60;

export interface AssetValidationOk {
  ok: true;
  mime: string;
  ext: string;
  size: number;
  fileName: string;
}
export interface AssetValidationError {
  ok: false;
  error: string;
}
export type AssetValidation = AssetValidationOk | AssetValidationError;

/**
 * Assainit un nom de fichier affiché : retire les chemins et les traversées
 * « .. », neutralise les caractères de contrôle et borne la longueur. Ne sert
 * qu'à l'affichage — le chemin de stockage réel est toujours un UUID sans PII.
 */
export function sanitizeFileName(name: string, fallbackExt: string): string {
  const base = (name ?? "")
    .replace(/[\\/]+/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/[\x00-\x1f\x7f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = base.length > 0 ? base : `fichier.${fallbackExt}`;
  return cleaned.slice(0, 200);
}

function validateAgainst(
  allowed: Record<string, string>,
  maxBytes: number,
  input: { mime: string; size: number; fileName: string },
  typeError: string,
): AssetValidation {
  const ext = allowed[input.mime];
  if (!ext) return { ok: false, error: typeError };
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Fichier vide." };
  }
  if (input.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `Fichier trop volumineux (${mb} Mo maximum).` };
  }
  return {
    ok: true,
    mime: input.mime,
    ext,
    size: input.size,
    fileName: sanitizeFileName(input.fileName, ext),
  };
}

/** Valide un média (image / vidéo / PDF). */
export function validateMedia(input: {
  mime: string;
  size: number;
  fileName: string;
}): AssetValidation {
  return validateAgainst(
    ALLOWED_MEDIA_MIME,
    MAX_MEDIA_BYTES,
    input,
    "Type de média non autorisé (JPEG, PNG, WEBP, PDF ou MP4 uniquement).",
  );
}

/** Valide un document (PDF / JPEG / PNG). */
export function validateDocument(input: {
  mime: string;
  size: number;
  fileName: string;
}): AssetValidation {
  return validateAgainst(
    ALLOWED_DOCUMENT_MIME,
    MAX_DOCUMENT_BYTES,
    input,
    "Type de fichier non autorisé (PDF, JPEG ou PNG uniquement).",
  );
}

/** Chemin de stockage sans PII : `{propertyId}/{scope}/{uuid}.{ext}`. */
export function buildAssetPath(
  propertyId: string,
  scope: "media" | "documents",
  ext: string,
): string {
  return `${propertyId}/${scope}/${randomUUID()}.${ext}`;
}

/**
 * Téléverse le fichier dans le bucket privé (rôle de service). Ne fait AUCUN
 * contrôle de rôle : l'appelant (action serveur) l'a déjà fait et la métadonnée
 * est enregistrée via `crm_property_register_*` (re-contrôle en base).
 */
export async function uploadPropertyAsset(input: {
  storagePath: string;
  bytes: ArrayBuffer | Buffer | Uint8Array;
  mime: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  const body =
    input.bytes instanceof Buffer ? input.bytes : Buffer.from(input.bytes as ArrayBuffer);
  const { error } = await admin.storage
    .from(PROPERTY_ASSETS_BUCKET)
    .upload(input.storagePath, body, { contentType: input.mime, upsert: false });
  if (error) return { ok: false, error: "Le téléversement du fichier a échoué." };
  return { ok: true };
}

/**
 * URL signée COURTE pour consulter un asset privé. Générée à la demande, jamais
 * stockée en base. Renvoie `null` en cas d'échec (aucune fuite).
 */
export async function createPropertyAssetSignedUrl(
  storagePath: string,
  expiresInSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(PROPERTY_ASSETS_BUCKET)
    .createSignedUrl(storagePath, Math.max(15, Math.min(expiresInSeconds, 300)));
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Supprime le fichier du bucket (best-effort). La métadonnée est déjà marquée
 * `supprime` par les fonctions `crm_property_delete_*` ; l'échec de suppression
 * physique ne doit pas bloquer l'utilisateur. Ne journalise jamais le contenu.
 */
export async function removePropertyAsset(storagePath: string): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    await admin.storage.from(PROPERTY_ASSETS_BUCKET).remove([storagePath]);
  } catch {
    // best-effort : la métadonnée fait foi (statut `supprime`).
  }
}
