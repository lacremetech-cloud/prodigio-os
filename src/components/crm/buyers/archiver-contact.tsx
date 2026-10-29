"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiverContactAction, retablirContactAction } from "@/modules/buyers/crm/actions";
import { FieldError, Saved, useAction } from "@/components/crm/property/shared";

/**
 * ARCHIVER UN CONTACT — bouton réservé à l'administrateur.
 *
 * Le geste retire la fiche des listes de TOUTE l'équipe : de la liste de
 * travail, du Kanban, des six compteurs et des récapitulatifs de 8 h 30, 13 h
 * et 17 h 30. Il mérite donc deux clics, pas un.
 *
 * Il ne supprime rien. L'historique d'appels, les tâches et les notes restent
 * en place, et un autre administrateur peut rétablir la fiche depuis
 * « Contacts archivés ». Le texte le dit, parce qu'un bouton dont on redoute
 * l'effet est un bouton qu'on n'utilise pas — et les listes resteraient sales.
 *
 * Ce composant ne porte AUCUN droit : il ne fait que ne pas s'afficher. C'est
 * `crm_buyer_archive` qui refuse un manager, un setter ou un commercial, même
 * si l'appel est forgé à la main.
 */
export function ArchiverContact({
  buyerProfileId,
  nom,
}: {
  buyerProfileId: string;
  nom: string;
}) {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");

  if (!ouvert) {
    return (
      <button
        type="button"
        className="crm-btn crm-btn--sm crm-btn--ghost"
        onClick={() => setOuvert(true)}
      >
        Archiver ce contact
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="crm-avertissement crm-wrap">
        <strong>{nom}</strong> sortira de la liste de travail, du pipeline et des récapitulatifs.
        Rien n’est supprimé : l’historique, les notes et les tâches restent, et un administrateur
        peut rétablir la fiche depuis « Contacts archivés ».
      </p>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Motif (facultatif)</span>
        <input
          className="crm-input"
          value={motif}
          maxLength={500}
          placeholder="Doublon, mauvais numéro, fiche de test…"
          onChange={(e) => setMotif(e.target.value)}
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--sm crm-btn--danger"
          disabled={pending}
          onClick={() =>
            run(
              () => archiverContactAction({ buyerProfileId, motif: motif.trim() || null }),
              /* La fiche vient de quitter les listes : rester dessus laisserait
                 l'administrateur devant un dossier qui n'existe plus nulle part
                 ailleurs, sans lui dire que c'est fait. */
              () => router.push("/crm/acquereurs"),
            )
          }
        >
          {pending ? "Archivage…" : "Confirmer l’archivage"}
        </button>
        <button
          type="button"
          className="crm-btn crm-btn--sm crm-btn--ghost"
          disabled={pending}
          onClick={() => {
            setOuvert(false);
            setMotif("");
          }}
        >
          Annuler
        </button>
      </div>
      <FieldError error={error} />
    </div>
  );
}

/** Rétablir — la porte de sortie, depuis l'écran des contacts archivés. */
export function RetablirContact({ buyerProfileId }: { buyerProfileId: string }) {
  const { pending, error, done, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--sm"
          disabled={pending || done}
          onClick={() => run(() => retablirContactAction({ buyerProfileId }))}
        >
          {pending ? "Rétablissement…" : "Rétablir"}
        </button>
        <Saved show={done} />
      </div>
      <FieldError error={error} />
    </div>
  );
}
