"use client";

import { useId, useState } from "react";
import { ajouterRegleAction, lireMetaMaintenantAction, retirerRegleAction } from "@/modules/pilotage/meta/actions";
import { FieldError, Saved, useAction } from "@/components/crm/property/shared";

/**
 * Les gestes de l'écran Meta : lancer une lecture, ajouter une règle de
 * rattachement, en retirer une. Rien n'est écrit chez Meta : « Lire » ne fait
 * que lire.
 */

export function BoutonLireMaintenant({ desactive }: { desactive: boolean }) {
  const { pending, error, done, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="crm-btn crm-btn--primaire crm-btn--sm self-start"
          disabled={pending || desactive}
          onClick={() => run(() => lireMetaMaintenantAction())}
        >
          {pending ? "Lecture en cours…" : "Lire Meta maintenant"}
        </button>
        <Saved show={done && !pending} />
      </div>
      {pending ? (
        <p className="text-[11px] text-[var(--crm-text-faint)]">
          La première lecture remonte tout l’historique : elle peut prendre quelques minutes. Gardez la page ouverte.
        </p>
      ) : null}
      <FieldError error={error} />
    </div>
  );
}

export interface BienChoix {
  id: string;
  nom: string;
}

/**
 * Une règle de rattachement : un jeton de la convention de nommage, ou une
 * exception par identifiant de campagne ; vers un bien, un groupe de biens
 * (réparti au prorata du prix affiché), ou hors portefeuille.
 */
export function FormulaireRegle({
  biens,
  campagneId,
  onTermine,
}: {
  biens: BienChoix[];
  /** Préremplit une exception pour cette campagne. */
  campagneId?: string;
  onTermine?: () => void;
}) {
  const { pending, error, done, run } = useAction();
  // Les deux choix de cible forment UN groupe (flèches du clavier), propre à
  // chaque formulaire : l'écran en porte un par campagne.
  const groupeCible = useId();
  const [type, setType] = useState<"jeton" | "campagne">(campagneId ? "campagne" : "jeton");
  const [valeur, setValeur] = useState(campagneId ?? "");
  const [cible, setCible] = useState<"biens" | "hors_portefeuille">("biens");
  const [choisis, setChoisis] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);

  function basculer(id: string) {
    setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreurLocale(null);
    if (!valeur.trim()) return setErreurLocale("Indiquez le jeton ou l’identifiant de campagne.");
    if (cible === "biens" && choisis.length === 0) return setErreurLocale("Choisissez au moins un bien.");
    run(
      () =>
        ajouterRegleAction({
          typeRegle: type,
          valeur: valeur.trim(),
          cible,
          biens: cible === "biens" ? choisis : [],
          note: note.trim() || null,
        }),
      () => {
        if (!campagneId) setValeur("");
        setChoisis([]);
        setNote("");
        onTermine?.();
      },
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={soumettre} noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Règle</span>
          <select className="crm-select" value={type} onChange={(e) => setType(e.target.value as "jeton" | "campagne")}>
            <option value="jeton">Jeton du nom (BIEN dans le nom de la pub ou de la campagne)</option>
            <option value="campagne">Exception pour une campagne (identifiant)</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">{type === "jeton" ? "Jeton" : "Identifiant de campagne"}</span>
          <input
            className="crm-input"
            value={valeur}
            onChange={(e) => setValeur(e.target.value)}
            inputMode={type === "campagne" ? "numeric" : "text"}
            placeholder={type === "jeton" ? "ex. VERDUN" : "ex. 120200000000000000"}
          />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="crm-label mb-1">Rattacher à</legend>
        <div className="flex flex-wrap gap-4 text-sm text-[var(--crm-text)]">
          <label className="flex items-center gap-2">
            <input type="radio" name={groupeCible} checked={cible === "biens"} onChange={() => setCible("biens")} />
            un ou plusieurs biens
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={groupeCible}
              checked={cible === "hors_portefeuille"}
              onChange={() => setCible("hors_portefeuille")}
            />
            hors portefeuille (visible, hors indicateurs)
          </label>
        </div>
      </fieldset>
      {cible === "biens" ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="crm-label mb-1">Biens — plusieurs : la dépense se répartit au prorata du prix affiché</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--crm-text)]">
            {biens.map((b) => (
              <label key={b.id} className="flex items-center gap-2">
                <input type="checkbox" checked={choisis.includes(b.id)} onChange={() => basculer(b.id)} />
                {b.nom}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="flex min-w-0 flex-col gap-1">
        <span className="crm-label">Note (facultatif)</span>
        <input className="crm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Ancien bien, campagnes de 2025" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--primaire crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer la règle"}
        </button>
        <Saved show={done && !pending} />
        <FieldError error={erreurLocale ?? error} />
      </div>
    </form>
  );
}

/** « Exception pour cette campagne… » : le formulaire ne s'ouvre qu'à la demande. */
export function ExceptionCampagne({ biens, campagneId }: { biens: BienChoix[]; campagneId: string }) {
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) {
    return (
      <button type="button" className="crm-btn crm-btn--secondaire crm-btn--sm" onClick={() => setOuvert(true)}>
        Rattacher cette campagne…
      </button>
    );
  }
  return (
    <div className="mt-2 w-full rounded-[10px] border border-[var(--crm-line-soft)] p-3">
      <FormulaireRegle biens={biens} campagneId={campagneId} onTermine={() => setOuvert(false)} />
      <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm mt-2" onClick={() => setOuvert(false)}>
        Fermer
      </button>
    </div>
  );
}

/** Retirer une règle, en deux temps : elle reste dans l'historique, datée. */
export function RetirerRegle({ regleId, libelle }: { regleId: string; libelle: string }) {
  const { pending, error, run } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  if (!ouvert) {
    return (
      <button
        type="button"
        className="crm-btn crm-btn--secondaire crm-btn--sm"
        onClick={() => setOuvert(true)}
        aria-label={`Retirer la règle ${libelle}`}
      >
        Retirer…
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <label className="flex min-w-0 flex-col gap-1">
        <span className="crm-label">Pourquoi ? (facultatif)</span>
        <input className="crm-input" value={motif} onChange={(e) => setMotif(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--danger crm-btn--sm"
          disabled={pending}
          onClick={() => run(() => retirerRegleAction({ regleId, motif: motif.trim() || null }), () => setOuvert(false))}
        >
          {pending ? "Retrait…" : "Confirmer le retrait"}
        </button>
        <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" disabled={pending} onClick={() => setOuvert(false)}>
          Garder
        </button>
      </div>
      <FieldError error={error} />
    </div>
  );
}
