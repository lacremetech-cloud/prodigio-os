"use client";

import { useState } from "react";
import { planifierVisiteAction } from "@/modules/buyers/crm/actions";
import { safeAction } from "@/modules/crm/safe-action";

/**
 * Caler une visite, en un seul geste.
 *
 * C'est le moment le plus important du suivi, et il se jouait en deux temps :
 * créer une tâche, puis déplacer la carte. Deux gestes pour un seul fait, donc
 * deux occasions d'en oublier un — et un tableau de bord qui annonçait
 * « 0 visite planifiée » alors que la visite était bien prise.
 *
 * Le champ est un `datetime-local` : sur un téléphone, il ouvre le sélecteur
 * natif, qui est ce qu'un commercial manipule le plus vite.
 */
export function PlanifierVisite({ buyerProfileId }: { buyerProfileId: string }) {
  const [quand, setQuand] = useState("");
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!quand) return;
        setErreur(null);
        setFait(false);
        setEnCours(true);
        // `datetime-local` rend une heure LOCALE sans fuseau : on la convertit
        // explicitement, sinon une visite de 14 h partirait en base à 14 h UTC.
        const iso = new Date(quand).toISOString();
        const res = await safeAction(() =>
          planifierVisiteAction({ buyerProfileId, at: iso, note: note.trim() || null }),
        );
        setEnCours(false);
        if (res.ok) {
          setFait(true);
          setNote("");
        } else {
          setErreur(res.error ?? "La visite n'a pas pu être enregistrée.");
        }
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Date et heure</span>
          <input
            className="crm-input"
            type="datetime-local"
            value={quand}
            onChange={(e) => setQuand(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Précision (facultatif)</span>
          <input
            className="crm-input"
            type="text"
            maxLength={300}
            placeholder="Devant le portail, 2e visite…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="crm-btn crm-btn--primaire crm-btn--sm" type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Planifier la visite"}
        </button>
        {fait ? (
          <span className="text-xs font-semibold text-[var(--crm-success)]">
            Visite enregistrée — le dossier passe à l’étape « Visite ».
          </span>
        ) : null}
      </div>
      {erreur ? <p className="text-xs text-[var(--crm-danger)]">{erreur}</p> : null}
    </form>
  );
}
