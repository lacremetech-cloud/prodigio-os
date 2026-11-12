"use client";

import { useState } from "react";
import { enregistrerLotAction } from "@/modules/pilotage/actions";
import {
  STATUTS_COMMERCIAUX,
  statutCommercialLabels,
  type StatutCommercial,
} from "@/modules/pilotage/labels";
import { centimesPourSaisie } from "@/modules/pilotage/affichage";
import { parseEurosToCents } from "@/modules/pilotage/saisie";
import type { PilotageLotVersionRow } from "@/lib/supabase/types";
import { FieldError, Saved, useAction } from "@/components/crm/property/shared";

/**
 * Un lot d'un programme : le créer (son numéro ne changera plus), ou lui
 * donner un nouvel état — prix, statut, vente, retrait. L'état précédent
 * reste dans l'historique du lot : on ajoute, on n'efface pas.
 */
function FormulaireLot({
  propertyId,
  lotId,
  etat,
  onTermine,
}: {
  propertyId: string;
  /** `null` : nouveau lot. */
  lotId: string | null;
  etat: PilotageLotVersionRow | null;
  onTermine: () => void;
}) {
  const { pending, error, done, run } = useAction();
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [description, setDescription] = useState(etat?.description ?? "");
  const [prix, setPrix] = useState(centimesPourSaisie(etat?.prix_cents));
  const [statut, setStatut] = useState<StatutCommercial>(etat?.statut_commercial ?? "a_vendre");
  const [prixFinal, setPrixFinal] = useState(centimesPourSaisie(etat?.prix_vente_final_cents));
  const [venduLe, setVenduLe] = useState(etat?.vendu_le ?? "");
  const [retire, setRetire] = useState(etat?.retire ?? false);
  const [motif, setMotif] = useState("");
  const nouveau = lotId === null;
  const vendu = statut === "vendu";

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreurLocale(null);
    const prixCentimes = parseEurosToCents(prix);
    const finalCentimes = vendu ? parseEurosToCents(prixFinal) : null;
    const fautes: string[] = [];
    if (nouveau && !numero.trim()) fautes.push("indiquez le numéro du lot");
    if (prixCentimes === undefined) fautes.push("prix illisible");
    if (finalCentimes === undefined) fautes.push("prix de vente final illisible");
    if (!motif.trim()) fautes.push("indiquez le motif");
    if (fautes.length > 0) {
      setErreurLocale(`À corriger : ${fautes.join(", ")}.`);
      return;
    }
    run(
      () =>
        enregistrerLotAction({
          lotId,
          propertyId,
          numero: nouveau ? numero.trim() : null,
          description: description.trim() || null,
          prixCentimes: prixCentimes ?? null,
          statutCommercial: statut,
          prixVenteFinalCentimes: finalCentimes ?? null,
          venduLe: vendu && venduLe ? venduLe : null,
          retire: nouveau ? false : retire,
          motif: motif.trim(),
        }),
      () => {
        setMotif("");
        if (nouveau) {
          setNumero("");
          setDescription("");
          setPrix("");
        }
        onTermine();
      },
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={soumettre} noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {nouveau ? (
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Numéro du lot</span>
            <input className="crm-input" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ex. 5" required />
          </label>
        ) : null}
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Description (facultatif)</span>
          <input className="crm-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex. T3 avec terrasse" />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Prix (€)</span>
          <input className="crm-input" inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="ex. 480 000" />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Statut commercial</span>
          <select className="crm-select" value={statut} onChange={(e) => setStatut(e.target.value as StatutCommercial)}>
            {STATUTS_COMMERCIAUX.map((s) => (
              <option key={s} value={s}>
                {statutCommercialLabels[s]}
              </option>
            ))}
          </select>
        </label>
        {vendu ? (
          <>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="crm-label">Prix de vente final (€)</span>
              <input className="crm-input" inputMode="decimal" value={prixFinal} onChange={(e) => setPrixFinal(e.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="crm-label">Date de la vente</span>
              <input type="date" className="crm-input" value={venduLe} onChange={(e) => setVenduLe(e.target.value)} />
            </label>
          </>
        ) : null}
      </div>
      {!nouveau ? (
        <label className="flex items-start gap-2 text-sm text-[var(--crm-text)]">
          <input type="checkbox" className="mt-1" checked={retire} onChange={(e) => setRetire(e.target.checked)} />
          <span>
            Retirer ce lot du pilotage
            <span className="block text-[11px] text-[var(--crm-text-faint)]">
              Saisie erronée ou lot sorti du programme. Rien n’est effacé ; il peut revenir.
            </span>
          </span>
        </label>
      ) : null}
      <label className="flex min-w-0 flex-col gap-1">
        <span className="crm-label">Motif</span>
        <input
          className="crm-input"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder={nouveau ? "ex. Grille du promoteur au 12/11/2026" : "ex. Compromis signé chez le notaire"}
          required
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--primaire crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : nouveau ? "Ajouter le lot" : "Enregistrer le nouvel état"}
        </button>
        <button type="button" className="crm-btn crm-btn--ghost crm-btn--sm" onClick={onTermine} disabled={pending}>
          Fermer
        </button>
        <Saved show={done && !pending} />
        <FieldError error={erreurLocale ?? error} />
      </div>
    </form>
  );
}

/** « Ajouter un lot » : le formulaire ne s'ouvre qu'à la demande. */
export function AjouterLot({ propertyId }: { propertyId: string }) {
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) {
    return (
      <button type="button" className="crm-btn crm-btn--secondaire crm-btn--sm self-start" onClick={() => setOuvert(true)}>
        + Ajouter un lot
      </button>
    );
  }
  return (
    <div className="crm-panel-2 p-4">
      <FormulaireLot propertyId={propertyId} lotId={null} etat={null} onTermine={() => setOuvert(false)} />
    </div>
  );
}

/** « Modifier » sur un lot : un nouvel état, à partir de l'état courant. */
export function ModifierLot({
  propertyId,
  lotId,
  numero,
  etat,
}: {
  propertyId: string;
  lotId: string;
  numero: string;
  etat: PilotageLotVersionRow | null;
}) {
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) {
    return (
      <button
        type="button"
        className="crm-btn crm-btn--secondaire crm-btn--sm"
        onClick={() => setOuvert(true)}
        aria-label={`Modifier le lot ${numero}`}
      >
        Modifier
      </button>
    );
  }
  return (
    <div className="mt-3 w-full border-t border-[var(--crm-line-soft)] pt-3">
      <FormulaireLot propertyId={propertyId} lotId={lotId} etat={etat} onTermine={() => setOuvert(false)} />
    </div>
  );
}
