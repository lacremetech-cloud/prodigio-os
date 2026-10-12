"use client";

import { useState } from "react";
import { setPropertyWorkspaceAction } from "@/modules/properties/factory/actions";
import { FieldError, Saved, useAction } from "./shared";

/**
 * Lien de l'espace de travail du bien.
 *
 * Les documents, photos et livrables vivent dans Drive. Le cockpit ne cherche
 * pas à les héberger — il n'en serait qu'une copie de moins bonne qualité, à
 * tenir à jour. Il porte le lien, à un endroit où on le retrouve.
 *
 * Le champ vidé retire le lien : c'est le geste naturel, et il évite une
 * deuxième commande « supprimer » pour une seule valeur.
 */
export function EspaceTravail({
  propertyId,
  url,
  canEdit,
}: {
  propertyId: string;
  url: string | null;
  canEdit: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [valeur, setValeur] = useState(url ?? "");

  if (!canEdit) {
    return url ? (
      <a
        className="crm-wrap text-sm font-medium text-[var(--crm-univers)] underline underline-offset-2"
        href={url}
        target="_blank"
        rel="noreferrer noopener"
      >
        Ouvrir l’espace de travail ↗
      </a>
    ) : (
      <p className="text-sm text-[var(--crm-text-dim)]">Aucun espace de travail renseigné.</p>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() =>
          setPropertyWorkspaceAction({
            propertyId,
            url: valeur.trim() === "" ? null : valeur.trim(),
          }),
        );
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="crm-label">Lien Drive</span>
        <input
          className="crm-input"
          type="url"
          inputMode="url"
          placeholder="https://drive.google.com/drive/folders/…"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className="crm-btn crm-btn--primaire crm-btn--sm" type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {url ? (
          <a className="crm-btn crm-btn--sm" href={url} target="_blank" rel="noreferrer noopener">
            Ouvrir ↗
          </a>
        ) : null}
        <Saved show={done} />
      </div>
      <FieldError error={error} />
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        Photos, documents et livrables restent dans Drive. Le CRM mène à eux, il ne les héberge pas.
      </p>
    </form>
  );
}
