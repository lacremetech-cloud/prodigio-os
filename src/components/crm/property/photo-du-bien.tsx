"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  setPrimaryMediaAction,
  uploadPropertyMediaAction,
} from "@/modules/properties/factory/actions";
import { FieldError, Saved, useAction } from "./shared";
import { safeAction } from "@/modules/crm/safe-action";

/**
 * Photo du bien — celle qui sert de vignette au portefeuille et de couverture
 * au cockpit. Une seule, remplaçable.
 *
 * Ce qui remplace la médiathèque : toutes les photos vivent dans Drive, et une
 * bibliothèque interne n'en aurait été qu'une copie à tenir à jour. Mais une
 * vignette doit s'afficher dans le CRM sans ouvrir Drive — c'est la seule
 * image que le produit a besoin de détenir.
 *
 * Le dépôt enchaîne deux actions : l'image est enregistrée, puis désignée
 * comme principale. Si la seconde échoue, l'image reste déposée et un nouvel
 * essai la désignera — on ne laisse jamais un fichier orphelin.
 */
export function PhotoDuBien({
  propertyId,
  apercuUrl,
  canEdit,
}: {
  propertyId: string;
  apercuUrl: string | null;
  canEdit: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const fichierRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="crm-media-vide relative aspect-[16/9] w-full max-w-sm overflow-hidden rounded-[12px]">
        {apercuUrl ? (
          <Image src={apercuUrl} alt="" fill sizes="384px" className="object-cover" unoptimized />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl" aria-hidden>
            ◆
          </span>
        )}
      </div>

      {canEdit ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fichier = fichierRef.current?.files?.[0];
            if (!fichier) return;
            const fd = new FormData();
            fd.set("propertyId", propertyId);
            fd.set("kind", "couverture");
            fd.set("file", fichier);
            run(
              async () => {
                // Chaque appel passe par `safeAction` : un rejet non rattrapé
                // dans une transition React remplace l'ecran entier.
                const depot = await safeAction(() => uploadPropertyMediaAction(fd));
                if (!depot.ok) return depot;
                const mediaId = "data" in depot ? depot.data?.id : undefined;
                if (typeof mediaId !== "string") return depot;
                return safeAction(() => setPrimaryMediaAction({ propertyId, mediaId }));
              },
              () => {
                if (fichierRef.current) fichierRef.current.value = "";
              },
            );
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="crm-label">Remplacer la photo</span>
            <input ref={fichierRef} className="crm-input" type="file" accept="image/*" />
          </label>
          <div className="flex items-center gap-2">
            <button className="crm-btn crm-btn--primaire crm-btn--sm" type="submit" disabled={pending}>
              {pending ? "Envoi…" : "Enregistrer la photo"}
            </button>
            <Saved show={done} />
          </div>
          <FieldError error={error} />
        </form>
      ) : null}
    </div>
  );
}
