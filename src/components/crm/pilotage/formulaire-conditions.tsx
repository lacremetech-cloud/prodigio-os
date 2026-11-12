"use client";

import { useId, useState } from "react";
import { enregistrerConditionsAction } from "@/modules/pilotage/actions";
import {
  BASES_HONORAIRES,
  baseHonorairesLabels,
  NATURES_PRIX,
  naturePrixLabels,
  STATUTS_COMMERCIAUX,
  statutCommercialLabels,
  type NaturePrix,
  type StatutCommercial,
} from "@/modules/pilotage/labels";
import { centimesPourSaisie, pourcentagePourSaisie } from "@/modules/pilotage/affichage";
import { parseEurosToCents, parsePourcentage } from "@/modules/pilotage/saisie";
import type { PilotageConditionsRow } from "@/lib/supabase/types";
import { FieldError, Saved, useAction } from "@/components/crm/property/shared";

/**
 * Une NOUVELLE version des conditions de commercialisation d'un bien.
 *
 * Le formulaire part de la version en vigueur : modifier, c'est ajouter une
 * ligne datée, avec un motif — l'ancienne reste dans l'historique. Pour une
 * première saisie, rien n'est prérempli, sauf ce qui n'est pas un chiffre :
 * aucune valeur économique n'est présentée comme une vérité.
 */
export function FormulaireConditions({
  propertyId,
  jour,
  initiale,
  sousMandat,
}: {
  propertyId: string;
  /** Aujourd'hui à Paris, « AAAA-MM-JJ » : date d'effet proposée. */
  jour: string;
  /** La version en vigueur (ou la plus récente), pour partir de ses valeurs. */
  initiale: PilotageConditionsRow | null;
  /** Le bien a un mandat : sa photographie peut fournir la part de Prodigio. */
  sousMandat: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);
  const ids = useId();

  const [dateEffet, setDateEffet] = useState(jour);
  const [mode, setMode] = useState<"bloc" | "lots">(initiale?.vente_par_lots ? "lots" : "bloc");
  const [naturePrix, setNaturePrix] = useState<NaturePrix>(initiale?.nature_prix ?? "fai");
  const [prix, setPrix] = useState(centimesPourSaisie(initiale?.prix_affiche_cents));
  const [taux, setTaux] = useState(pourcentagePourSaisie(initiale?.taux_commission_pct, 4));
  const [base, setBase] = useState<string>(initiale?.base_honoraires ?? "");
  const [part, setPart] = useState(pourcentagePourSaisie(initiale?.part_prodigio_pct, 2));
  const [tva, setTva] = useState(pourcentagePourSaisie(initiale?.taux_tva_pct, 2));
  const [statut, setStatut] = useState<StatutCommercial>(initiale?.statut_commercial ?? "a_vendre");
  const [prixFinal, setPrixFinal] = useState(centimesPourSaisie(initiale?.prix_vente_final_cents));
  const [venduLe, setVenduLe] = useState(initiale?.vendu_le ?? "");
  const [motif, setMotif] = useState("");

  const parLots = mode === "lots";
  const vendu = !parLots && statut === "vendu";

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreurLocale(null);

    const prixCentimes = parLots ? null : parseEurosToCents(prix);
    const tauxPct = parsePourcentage(taux, 4);
    const partPct = parsePourcentage(part, 2);
    const tvaPct = parsePourcentage(tva, 2);
    const finalCentimes = vendu ? parseEurosToCents(prixFinal) : null;

    const fautes: string[] = [];
    if (prixCentimes === undefined) fautes.push("prix affiché illisible");
    if (tauxPct === undefined) fautes.push("taux de commission illisible (ex. 3,75)");
    if (partPct === undefined) fautes.push("part de Prodigio illisible (ex. 70)");
    if (tvaPct === undefined) fautes.push("taux de TVA illisible (ex. 20)");
    if (finalCentimes === undefined) fautes.push("prix de vente final illisible");
    if (!base) fautes.push("choisissez la base des honoraires");
    if (!motif.trim()) fautes.push("indiquez le motif");
    if (fautes.length > 0) {
      setErreurLocale(`À corriger : ${fautes.join(", ")}.`);
      return;
    }

    run(
      () =>
        enregistrerConditionsAction({
          propertyId,
          dateEffet,
          venteParLots: parLots,
          naturePrix,
          prixAfficheCentimes: prixCentimes ?? null,
          tauxCommissionPct: tauxPct ?? null,
          baseHonoraires: base,
          partProdigioPct: partPct ?? null,
          tauxTvaPct: tvaPct ?? null,
          statutCommercial: parLots ? null : statut,
          prixVenteFinalCentimes: finalCentimes ?? null,
          venduLe: vendu && venduLe ? venduLe : null,
          motif: motif.trim(),
        }),
      () => setMotif(""),
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={soumettre} noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="crm-label mb-1">Le bien se vend</legend>
        <div className="flex flex-wrap gap-4 text-sm text-[var(--crm-text)]">
          <label className="flex items-center gap-2">
            <input type="radio" name={`${ids}-mode`} checked={!parLots} onChange={() => setMode("bloc")} />
            en un seul bloc
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name={`${ids}-mode`} checked={parLots} onChange={() => setMode("lots")} />
            par lots (programme)
          </label>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-1 sm:col-span-2">
          <span className="crm-label">Le prix saisi est</span>
          <select className="crm-select" value={naturePrix} onChange={(e) => setNaturePrix(e.target.value as NaturePrix)}>
            {NATURES_PRIX.map((n) => (
              <option key={n} value={n}>
                {naturePrixLabels[n]}
              </option>
            ))}
          </select>
        </label>

        {!parLots ? (
          <div className="flex min-w-0 flex-col gap-1">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="crm-label">Prix affiché (€)</span>
              <input
                className="crm-input"
                inputMode="decimal"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                placeholder="ex. 1 250 000"
                aria-describedby={`${ids}-prix`}
              />
            </label>
            <span id={`${ids}-prix`} className="text-[11px] text-[var(--crm-text-faint)]">
              Vide : le prix s’affichera « manquant ».
            </span>
          </div>
        ) : (
          <p className="crm-wrap text-xs text-[var(--crm-text-dim)] sm:col-span-2">
            Par lots : le prix, le statut et la vente se saisissent lot par lot, dans la section des lots.
          </p>
        )}

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Taux de commission (%)</span>
          <input
            className="crm-input"
            inputMode="decimal"
            value={taux}
            onChange={(e) => setTaux(e.target.value)}
            placeholder="ex. 4,5"
          />
        </label>

        <label className="flex min-w-0 flex-col gap-1">
          <span className="crm-label">Base des honoraires</span>
          <select className="crm-select" value={base} onChange={(e) => setBase(e.target.value)} required>
            <option value="" disabled>
              Choisir…
            </option>
            {BASES_HONORAIRES.map((b) => (
              <option key={b} value={b}>
                {baseHonorairesLabels[b]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex min-w-0 flex-col gap-1">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Part de Prodigio (%)</span>
            <input
              className="crm-input"
              inputMode="decimal"
              value={part}
              onChange={(e) => setPart(e.target.value)}
              placeholder="ex. 60"
              aria-describedby={`${ids}-part`}
            />
          </label>
          <span id={`${ids}-part`} className="text-[11px] text-[var(--crm-text-faint)]">
            {sousMandat
              ? "Vide : reprise de la photographie économique du mandat."
              : "Vide : la part s’affichera « manquante »."}
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">TVA sur les honoraires (%)</span>
            <input
              className="crm-input"
              inputMode="decimal"
              value={tva}
              onChange={(e) => setTva(e.target.value)}
              placeholder="ex. 20"
              aria-describedby={`${ids}-tva`}
            />
          </label>
          <span id={`${ids}-tva`} className="text-[11px] text-[var(--crm-text-faint)]">
            Sert à passer de la commission TTC à la commission HT.
          </span>
        </div>

        {!parLots ? (
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Statut commercial</span>
            <select
              className="crm-select"
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutCommercial)}
            >
              {STATUTS_COMMERCIAUX.map((s) => (
                <option key={s} value={s}>
                  {statutCommercialLabels[s]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {vendu ? (
          <>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="crm-label">Prix de vente final (€)</span>
              <input
                className="crm-input"
                inputMode="decimal"
                value={prixFinal}
                onChange={(e) => setPrixFinal(e.target.value)}
                placeholder="prix réellement payé"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="crm-label">Date de la vente</span>
              <input type="date" className="crm-input" value={venduLe} onChange={(e) => setVenduLe(e.target.value)} />
            </label>
          </>
        ) : null}

        <div className="flex min-w-0 flex-col gap-1">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Date d’effet</span>
            <input
              type="date"
              className="crm-input"
              value={dateEffet}
              onChange={(e) => setDateEffet(e.target.value)}
              required
              aria-describedby={`${ids}-effet`}
            />
          </label>
          <span id={`${ids}-effet`} className="text-[11px] text-[var(--crm-text-faint)]">
            Le calcul prend la version dont la date d’effet est la plus récente sans dépasser aujourd’hui.
          </span>
        </div>
      </div>

      <label className="flex min-w-0 flex-col gap-1">
        <span className="crm-label">Motif</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="ex. Saisie initiale du portefeuille · Baisse de prix décidée avec le vendeur"
          required
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--primaire crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : initiale ? "Enregistrer cette nouvelle version" : "Enregistrer les conditions"}
        </button>
        <Saved show={done && !pending} />
        <FieldError error={erreurLocale ?? error} />
      </div>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        Rien n’est écrasé : la version actuelle reste dans l’historique, avec sa date et son auteur.
      </p>
    </form>
  );
}
