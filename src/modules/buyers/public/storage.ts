import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Couche Storage du bucket **PUBLIC** dédié aux médias approuvés pour diffusion
 * (`property-public`). DISTINCT du bucket privé `property-assets` de la Fabrique,
 * qui n'est JAMAIS rendu public. Seuls des médias EXPRESSÉMENT approuvés y sont
 * déposés (aucun document légal). Aucune PII dans le chemin de stockage :
 * `{propertyId}/public/{uuid}.{ext}`.
 *
 * Le bucket étant public, l'objet est servi directement (URL publique
 * reconstruite côté application) — aucune URL signée n'est nécessaire.
 */

export const PROPERTY_PUBLIC_BUCKET = "property-public";

/** Types autorisés pour un média public (jamais de PDF ni de document). */
export const ALLOWED_PUBLIC_MEDIA_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
};

/** Poids maximal d'un média public (image lourde / vidéo légère). */
export const MAX_PUBLIC_MEDIA_BYTES = 100 * 1024 * 1024;

export interface PublicMediaValidationOk {
  ok: true;
  mime: string;
  ext: string;
  size: number;
  fileName: string;
}
export interface PublicMediaValidationError {
  ok: false;
  error: string;
}
export type PublicMediaValidation = PublicMediaValidationOk | PublicMediaValidationError;

/** Assainit un nom de fichier affiché (jamais utilisé dans le chemin réel). */
export function sanitizePublicFileName(name: string, fallbackExt: string): string {
  const base = (name ?? "")
    .replace(/[\\/]+/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/[\x00-\x1f\x7f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = base.length > 0 ? base : `media.${fallbackExt}`;
  return cleaned.slice(0, 200);
}

export function validatePublicMedia(input: {
  mime: string;
  size: number;
  fileName: string;
}): PublicMediaValidation {
  const ext = ALLOWED_PUBLIC_MEDIA_MIME[input.mime];
  if (!ext) {
    return { ok: false, error: "Type non autorisé pour le public (JPEG, PNG, WEBP ou MP4)." };
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Fichier vide." };
  }
  if (input.size > MAX_PUBLIC_MEDIA_BYTES) {
    const mb = Math.round(MAX_PUBLIC_MEDIA_BYTES / (1024 * 1024));
    return { ok: false, error: `Fichier trop volumineux (${mb} Mo maximum).` };
  }
  return {
    ok: true,
    mime: input.mime,
    ext,
    size: input.size,
    fileName: sanitizePublicFileName(input.fileName, ext),
  };
}

/** Chemin de stockage sans PII : `{propertyId}/public/{uuid}.{ext}`. */
export function buildPublicAssetPath(propertyId: string, ext: string): string {
  return `${propertyId}/public/${randomUUID()}.${ext}`;
}

/** Téléverse le fichier dans le bucket public (rôle de service). */
export async function uploadPublicAsset(input: {
  storagePath: string;
  bytes: ArrayBuffer | Buffer | Uint8Array;
  mime: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  const body =
    input.bytes instanceof Buffer ? input.bytes : Buffer.from(input.bytes as ArrayBuffer);
  const { error } = await admin.storage
    .from(PROPERTY_PUBLIC_BUCKET)
    .upload(input.storagePath, body, { contentType: input.mime, upsert: false });
  if (error) return { ok: false, error: "Le téléversement du média public a échoué." };
  return { ok: true };
}

/** Supprime le fichier du bucket public (best-effort ; la métadonnée fait foi). */
export async function removePublicAsset(storagePath: string): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    await admin.storage.from(PROPERTY_PUBLIC_BUCKET).remove([storagePath]);
  } catch {
    // best-effort : la métadonnée (statut `supprime`) fait foi.
  }
}
