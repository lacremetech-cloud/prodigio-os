"use client";

import { useRef, useState, useTransition } from "react";
import {
  deletePropertyDocumentAction,
  getPropertyAssetSignedUrlAction,
  uploadPropertyDocumentAction,
} from "@/modules/properties/factory/actions";
import {
  documentCategoryLabels,
  documentStatusLabels,
  documentVisibilityLabels,
} from "@/modules/properties/factory/labels";
import type { PropertyDocumentCategory, PropertyDocumentRow } from "@/lib/supabase/types";
import { formatDateTime } from "@/modules/crm/format";
import { FieldError, Saved, useAction } from "./shared";

const CATEGORIES: PropertyDocumentCategory[] = [
  "mandat",
  "diagnostic",
  "plan",
  "titre",
  "legal",
  "copropriete",
  "autorisation",
  "libre",
];

export function DocumentsManager({
  propertyId,
  documents,
  canAdd,
  canDelete,
}: {
  propertyId: string;
  documents: PropertyDocumentRow[];
  canAdd: boolean;
  canDelete: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [category, setCategory] = useState<PropertyDocumentCategory>("mandat");
  const [visibility, setVisibility] = useState("interne");
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewing, startViewing] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const openDocument = (documentId: string) => {
    setViewError(null);
    startViewing(async () => {
      const res = await getPropertyAssetSignedUrlAction({
        assetType: "document",
        assetId: documentId,
      });
      if (res.ok && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else setViewError(res.error ?? "Impossible d’ouvrir le document.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canAdd ? (
        <form
          className="flex flex-col gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const file = fileRef.current?.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("propertyId", propertyId);
            fd.set("category", category);
            fd.set("visibility", visibility);
            fd.set("file", file);
            run(
              () => uploadPropertyDocumentAction(fd),
              () => {
                if (fileRef.current) fileRef.current.value = "";
              },
            );
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Catégorie</span>
              <select className="crm-select" value={category} onChange={(e) => setCategory(e.target.value as PropertyDocumentCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {documentCategoryLabels[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Visibilité</span>
              <select className="crm-select" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="interne">Interne</option>
                <option value="restreint">Restreint</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="crm-label">Fichier (PDF, JPEG ou PNG · 25 Mo max.)</span>
            <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" className="crm-input" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
              {pending ? "Téléversement…" : "Ajouter le document"}
            </button>
            <Saved show={done} />
            <FieldError error={error} />
          </div>
        </form>
      ) : null}

      {documents.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-8 text-center text-xs text-[var(--crm-text-faint)]">
          Aucun document. Les documents sont stockés de façon privée ; l’accès se fait par lien
          signé temporaire.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3"
            >
              <div className="min-w-0">
                <p className="crm-wrap text-sm text-[var(--crm-text)]">{d.file_name}</p>
                <p className="text-[11px] text-[var(--crm-text-faint)]">
                  {documentCategoryLabels[d.category]} · {documentStatusLabels[d.doc_status] ?? d.doc_status} ·{" "}
                  {documentVisibilityLabels[d.visibility] ?? d.visibility} · {formatDateTime(d.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="crm-btn crm-btn--sm crm-btn--ghost"
                  disabled={viewing}
                  onClick={() => openDocument(d.id)}
                >
                  {viewing ? "…" : "Consulter"}
                </button>
                {canDelete ? (
                  confirmId === d.id ? (
                    <>
                      <button
                        type="button"
                        className="crm-btn crm-btn--sm crm-btn--danger"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => deletePropertyDocumentAction({ propertyId, documentId: d.id }),
                            () => setConfirmId(null),
                          )
                        }
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        className="crm-btn crm-btn--sm crm-btn--ghost"
                        onClick={() => setConfirmId(null)}
                      >
                        Annuler
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="crm-btn crm-btn--sm crm-btn--ghost"
                      onClick={() => setConfirmId(d.id)}
                    >
                      Supprimer
                    </button>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FieldError error={viewError} />
    </div>
  );
}
