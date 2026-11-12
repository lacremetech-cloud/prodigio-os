"use client";

import { useState } from "react";
import { annulerCoutFixeAction, saisirCoutFixeAction } from "@/modules/pilotage/actions";
import { TYPES_COUT, typeCoutLabels, type TypeCout } from "@/modules/pilotage/labels";
import { parseEurosToCents } from "@/modules/pilotage/saisie";
import { FieldError, Saved, useAction } from "@/components/crm/property/shared";

/**
 * Saisir un coût fixe HT. La date et l'heure sont notées d'office, par la
 * base : on ne les saisit pas.
 *
 * Le formulaire tire une CLÉ à son affichage. Envoyé deux fois — double clic,
 * réseau qui reprend —, il ne compte qu'une fois : la base reconnaît la clé.
 * Une nouvelle clé n'est tirée qu'après un enregistrement réussi.
 */
export function FormulaireCoutFixe({ propertyId }: { propertyId: string }) {
  const { pending, error, done, run } = useAction();
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);
  const [cle, setCle] = useState(() => crypto.randomUUID());
  const [type, setType] = useState<TypeCout | "">("");
  const [montant, setMontant] = useState("");
  const [note, setNote] = useState("");

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreurLocale(null);
    const centimes = parseEurosToCents(montant);
    const fautes: string[] = [];
    if (!type) fautes.push("choisissez le type");
    if (centimes == null || centimes <= 0) fautes.push("indiquez un montant HT positif");
    if (fautes.length > 0) {
      setErreurLocale(`À corriger : ${fautes.join(", ")}.`);
      return;
    }
    run(
      () =>
        saisirCoutFixeAction({
          propertyId,
          typeCout: type,
          montantHtCentimes: centimes,
          note: note.trim() || null,
          cleSaisie: cle,
        }),
      () => {
        setType("");
        setMontant("");
        setNote("");
        setCle(crypto.randomUUID());
      },
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={soumettre} noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Type</span>
          <select className="crm-select" value={type} onChange={(e) => setType(e.target.value as TypeCout | "")} required>
            <option value="" disabled>
              Choisir…
            </option>
            {TYPES_COUT.map((t) => (
              <option key={t} value={t}>
                {typeCoutLabels[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Montant HT (€)</span>
          <input
            className="crm-input"
            inputMode="decimal"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            placeholder="ex. 3 500"
            required
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 sm:col-span-3">
          <span className="crm-label">Note (facultatif)</span>
          <input className="crm-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex. Tournage du 10 novembre, facture n° …" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--primaire crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le coût"}
        </button>
        <Saved show={done && !pending} />
        <FieldError error={erreurLocale ?? error} />
      </div>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        La date et l’heure de la saisie sont notées d’office. Une erreur se corrige par « Annuler » : la ligne reste
        visible, barrée, et sort des calculs.
      </p>
    </form>
  );
}

/**
 * « Annuler » un coût fixe, en deux temps : on ne raye pas une dépense d'un
 * clic égaré. Le motif est facultatif mais conseillé.
 */
export function AnnulerCoutFixe({ coutId, libelle }: { coutId: string; libelle: string }) {
  const { pending, error, run } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");

  if (!ouvert) {
    return (
      <button
        type="button"
        className="crm-btn crm-btn--secondaire crm-btn--sm"
        onClick={() => setOuvert(true)}
        aria-label={`Annuler le coût : ${libelle}`}
      >
        Annuler…
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <label className="flex min-w-0 flex-col gap-1">
        <span className="crm-label">Pourquoi l’annuler ? (facultatif)</span>
        <input className="crm-input" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. Facture saisie deux fois" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--danger crm-btn--sm"
          disabled={pending}
          onClick={() => run(() => annulerCoutFixeAction({ coutId, motif: motif.trim() || null }), () => setOuvert(false))}
        >
          {pending ? "Annulation…" : "Confirmer l’annulation"}
        </button>
        <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" disabled={pending} onClick={() => setOuvert(false)}>
          Garder ce coût
        </button>
      </div>
      <FieldError error={error} />
    </div>
  );
}
