"use client";

import { useRef, useState, useTransition } from "react";
import {
  deletePropertyMediaAction,
  getPropertyAssetSignedUrlAction,
  setPrimaryMediaAction,
  updatePropertyMediaAction,
  uploadPropertyMediaAction,
} from "@/modules/properties/factory/actions";
import {
  mediaKindLabels,
  mediaRightsLabels,
} from "@/modules/properties/factory/labels";
import type { PropertyMediaKind, PropertyMediaRow } from "@/lib/supabase/types";
import { formatDateTime } from "@/modules/crm/format";
import { FieldError, Saved, useAction } from "./shared";
import { safeAction } from "@/modules/crm/safe-action";

const KINDS: PropertyMediaKind[] = ["photo", "video", "drone", "plan", "rendu", "couverture", "autre"];
const RIGHTS = ["a_verifier", "libre", "sous_licence", "restreint"] as const;

export function MediaManager({
  propertyId,
  media,
  mainMediaId,
  canEdit,
}: {
  propertyId: string;
  media: PropertyMediaRow[];
  mainMediaId: string | null;
  canEdit: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [kind, setKind] = useState<PropertyMediaKind>("photo");
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewing, startViewing] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const openMedia = (mediaId: string) => {
    setViewError(null);
    startViewing(async () => {
      const res = await safeAction(() =>
        getPropertyAssetSignedUrlAction({ assetType: "media", assetId: mediaId }),
      );
      if (res.ok && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else setViewError(res.error ?? "Impossible d’ouvrir le média.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <form
          className="flex flex-col gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const file = fileRef.current?.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("propertyId", propertyId);
            fd.set("kind", kind);
            if (title.trim()) fd.set("title", title.trim());
            fd.set("file", file);
            run(
              () => uploadPropertyMediaAction(fd),
              () => {
                if (fileRef.current) fileRef.current.value = "";
                setTitle("");
              },
            );
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Type</span>
              <select className="crm-select" value={kind} onChange={(e) => setKind(e.target.value as PropertyMediaKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {mediaKindLabels[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="crm-label">Titre (facultatif)</span>
              <input className="crm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Façade au coucher du soleil" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="crm-label">Fichier (JPEG, PNG, WEBP, PDF ou MP4 · 100 Mo max.)</span>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4" className="crm-input" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
              {pending ? "Téléversement…" : "Ajouter le média"}
            </button>
            <Saved show={done} />
            <FieldError error={error} />
          </div>
        </form>
      ) : null}

      {media.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-8 text-center text-xs text-[var(--crm-text-faint)]">
          Aucun média. Les fichiers sont stockés de façon privée ; l’accès se fait par lien signé
          temporaire.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {media.map((m) => {
            const isMain = m.id === mainMediaId;
            return (
              <li
                key={m.id}
                className="flex flex-col gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="crm-wrap text-sm text-[var(--crm-text)]">
                      {m.title || m.file_name}
                    </p>
                    <p className="text-[11px] text-[var(--crm-text-faint)]">
                      {mediaKindLabels[m.kind]} · {mediaRightsLabels[m.rights_status]} · {formatDateTime(m.created_at)}
                    </p>
                  </div>
                  {isMain ? <span className="crm-chip crm-chip--gold shrink-0">Image principale</span> : null}
                </div>

                {canEdit ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <MediaEditControls propertyId={propertyId} media={m} run={run} pending={pending} />
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="crm-btn crm-btn--sm crm-btn--ghost"
                    disabled={viewing}
                    onClick={() => openMedia(m.id)}
                  >
                    {viewing ? "…" : "Aperçu / télécharger"}
                  </button>
                  {canEdit && !isMain && m.kind !== "video" ? (
                    <button
                      type="button"
                      className="crm-btn crm-btn--sm crm-btn--ghost"
                      disabled={pending}
                      onClick={() => run(() => setPrimaryMediaAction({ propertyId, mediaId: m.id }))}
                    >
                      Définir comme principale
                    </button>
                  ) : null}
                  {canEdit ? (
                    confirmId === m.id ? (
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          className="crm-btn crm-btn--sm crm-btn--danger"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => deletePropertyMediaAction({ propertyId, mediaId: m.id }),
                              () => setConfirmId(null),
                            )
                          }
                        >
                          Confirmer la suppression
                        </button>
                        <button
                          type="button"
                          className="crm-btn crm-btn--sm crm-btn--ghost"
                          onClick={() => setConfirmId(null)}
                        >
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="crm-btn crm-btn--sm crm-btn--ghost"
                        onClick={() => setConfirmId(m.id)}
                      >
                        Supprimer
                      </button>
                    )
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <FieldError error={viewError} />
    </div>
  );
}

function MediaEditControls({
  propertyId,
  media,
  run,
  pending,
}: {
  propertyId: string;
  media: PropertyMediaRow;
  run: ReturnType<typeof useAction>["run"];
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(media.title ?? "");
  const [kind, setKind] = useState<PropertyMediaKind>(media.kind);
  const [rights, setRights] = useState<string>(media.rights_status);

  if (!open) {
    return (
      <button type="button" className="crm-btn crm-btn--sm crm-btn--ghost" onClick={() => setOpen(true)}>
        Modifier
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] p-2">
      <input className="crm-input text-xs" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
      <div className="flex flex-wrap gap-2">
        <select className="crm-select text-xs" value={kind} onChange={(e) => setKind(e.target.value as PropertyMediaKind)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {mediaKindLabels[k]}
            </option>
          ))}
        </select>
        <select className="crm-select text-xs" value={rights} onChange={(e) => setRights(e.target.value)}>
          {RIGHTS.map((r) => (
            <option key={r} value={r}>
              {mediaRightsLabels[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--sm"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                updatePropertyMediaAction({
                  propertyId,
                  mediaId: media.id,
                  title: title || null,
                  kind,
                  rightsStatus: rights as (typeof RIGHTS)[number],
                }),
              () => setOpen(false),
            )
          }
        >
          Enregistrer
        </button>
        <button type="button" className="crm-btn crm-btn--sm crm-btn--ghost" onClick={() => setOpen(false)}>
          Fermer
        </button>
      </div>
    </div>
  );
}
