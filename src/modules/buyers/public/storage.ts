import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Couche Storage du cycle de vie des médias publics. DEUX buckets dédiés,
 * DISTINCTS du bucket privé `property-assets` de la Fabrique (jamais rendu public) :
 *
 *  - `property-public-master` (**PRIVÉ**) : le MASTER de chaque média approuvé.
 *    Accès serveur uniquement ; URL **signée courte** pour la prévisualisation
 *    authentifiée. Jamais public.
 *  - `property-public` (**PUBLIC**) : les COPIES publiques des médias du bien
 *    PUBLIÉ, à des chemins FRAIS sans PII. Créées à la publication, **supprimées**
 *    à la dépublication / archivage.
 *
 * Aucune PII dans les chemins : master `{propertyId}/master/{uuid}.{ext}`,
 * copie publique `{propertyId}/pub/{uuid}.{ext}`.
 */

export const PROPERTY_PUBLIC_MASTER_BUCKET = "property-public-master";
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

/** Durée de vie d'une URL signée de master (prévisualisation) : courte (120 s). */
export const MASTER_SIGNED_URL_TTL_SECONDS = 120;

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

/** Chemin du MASTER (bucket privé) sans PII : `{propertyId}/master/{uuid}.{ext}`. */
export function buildMasterPath(propertyId: string, ext: string): string {
  return `${propertyId}/master/${randomUUID()}.${ext}`;
}

/** Chemin FRAIS d'une COPIE publique (bucket public) : `{propertyId}/pub/{uuid}.{ext}`. */
export function buildPublicCopyPath(propertyId: string, ext: string): string {
  return `${propertyId}/pub/${randomUUID()}.${ext}`;
}

/** Extension déduite d'un chemin (défaut jpg). */
function extOf(pathStr: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(pathStr);
  const ext = m?.[1];
  return ext ? ext.toLowerCase() : "jpg";
}

/** Téléverse le MASTER dans le bucket PRIVÉ (rôle de service). */
export async function uploadMasterAsset(input: {
  storagePath: string;
  bytes: ArrayBuffer | Buffer | Uint8Array;
  mime: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  const body =
    input.bytes instanceof Buffer ? input.bytes : Buffer.from(input.bytes as ArrayBuffer);
  const { error } = await admin.storage
    .from(PROPERTY_PUBLIC_MASTER_BUCKET)
    .upload(input.storagePath, body, { contentType: input.mime, upsert: false });
  if (error) return { ok: false, error: "Le téléversement du média a échoué." };
  return { ok: true };
}

/** URL signée COURTE d'un master (prévisualisation authentifiée). Jamais stockée. */
export async function createMasterSignedUrl(
  storagePath: string,
  expiresInSeconds: number = MASTER_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(PROPERTY_PUBLIC_MASTER_BUCKET)
    .createSignedUrl(storagePath, Math.max(30, Math.min(expiresInSeconds, 600)));
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Copie un MASTER (privé) vers une COPIE publique (bucket public), à un chemin
 * frais. Télécharge le master via le rôle de service puis téléverse dans le
 * bucket public — le master n'est JAMAIS rendu public lui-même.
 */
export async function copyMasterToPublic(input: {
  propertyId: string;
  masterPath: string;
  mime: string;
}): Promise<{ ok: true; publicPath: string } | { ok: false; error: string }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(PROPERTY_PUBLIC_MASTER_BUCKET)
    .download(input.masterPath);
  if (error || !data) return { ok: false, error: "Master introuvable pour la copie publique." };
  const publicPath = buildPublicCopyPath(input.propertyId, extOf(input.masterPath));
  const bytes = Buffer.from(await data.arrayBuffer());
  const up = await admin.storage
    .from(PROPERTY_PUBLIC_BUCKET)
    .upload(publicPath, bytes, { contentType: input.mime, upsert: false });
  if (up.error) return { ok: false, error: "La copie publique a échoué." };
  return { ok: true, publicPath };
}

/** Supprime des objets du bucket PUBLIC (best-effort). */
export async function removePublicObjects(paths: string[]): Promise<void> {
  const clean = paths.filter((p) => typeof p === "string" && p.length > 0);
  if (clean.length === 0) return;
  try {
    const admin = getSupabaseAdminClient();
    await admin.storage.from(PROPERTY_PUBLIC_BUCKET).remove(clean);
  } catch {
    // best-effort : la métadonnée (public_path = null) fait foi.
  }
}

/**
 * Supprime TOUTES les copies publiques d'un bien (par préfixe `{propertyId}/`).
 * Garantit qu'aucune copie d'une version précédente ne subsiste dans le bucket
 * public. Best-effort.
 */
export async function purgePublicCopies(propertyId: string): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    const { data } = await admin.storage
      .from(PROPERTY_PUBLIC_BUCKET)
      .list(`${propertyId}/pub`, { limit: 1000 });
    const paths = (data ?? []).map((o) => `${propertyId}/pub/${o.name}`);
    if (paths.length > 0) await admin.storage.from(PROPERTY_PUBLIC_BUCKET).remove(paths);
  } catch {
    // best-effort.
  }
}

/** Supprime un master (bucket privé) — best-effort. */
export async function removeMasterObject(storagePath: string): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    await admin.storage.from(PROPERTY_PUBLIC_MASTER_BUCKET).remove([storagePath]);
  } catch {
    // best-effort.
  }
}
