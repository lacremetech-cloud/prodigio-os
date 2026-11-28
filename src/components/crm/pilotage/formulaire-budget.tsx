"use client";

import { useId, useState } from "react";
import { enregistrerBudgetAction } from "@/modules/pilotage/actions";
import { libelleCible, type PropositionBudget } from "@/modules/pilotage/budget";
import {
  ciblesPossibles,
  erreurDesTranches,
  erreurDuReglage,
  TRANCHES_BUDGET,
  TRANCHES_PAR_DEFAUT,
  trierTranches,
  type TrancheBudget,
} from "@/modules/buyers/funnel/tranches";
import { BUDGET_CHOICE_LABELS } from "@/modules/buyers/funnel/universal";
import { FieldError, Saved, useAction } from "@/components/crm/property/shared";

/**
 * Une NOUVELLE version du budget du formulaire d'un bien : les tranches que
 * son formulaire propose, et la cible.
 *
 * Le formulaire part du réglage en vigueur ; sans réglage, de la proposition
 * d'après le prix, sinon des réponses d'aujourd'hui. Rien n'est appliqué tant
 * qu'on n'enregistre pas, avec un motif — l'ancienne version reste dans
 * l'historique.
 */
export function FormulaireBudget({
  propertyId,
  jour,
  initiale,
  proposition,
}: {
  propertyId: string;
  /** Aujourd'hui à Paris, « AAAA-MM-JJ » : date d'effet proposée. */
  jour: string;
  /** Le réglage en vigueur (ou le plus récent), pour partir de ses valeurs. */
  initiale: { tranches: TrancheBudget[]; cibleMinCentimes: number } | null;
  proposition: PropositionBudget | null;
}) {
  const { pending, error, done, run } = useAction();
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);
  const ids = useId();

  const depart = initiale ?? proposition;
  const [tranches, setTranches] = useState<TrancheBudget[]>(depart?.tranches ?? [...TRANCHES_PAR_DEFAUT]);
  const [cible, setCible] = useState<number | null>(depart?.cibleMinCentimes ?? null);
  const [dateEffet, setDateEffet] = useState(jour);
  const [motif, setMotif] = useState("");

  const triees = trierTranches(tranches);
  const cibles = ciblesPossibles(triees);
  const regle = erreurDuReglage(triees, cible);
  const regleTranches = erreurDesTranches(triees);

  function basculer(t: TrancheBudget) {
    setErreurLocale(null);
    const suivantes = tranches.includes(t) ? tranches.filter((x) => x !== t) : [...tranches, t];
    setTranches(suivantes);
    // Une cible qui n'est plus le bas d'une tranche proposée tombe : on la rechoisit.
    if (cible !== null && !ciblesPossibles(suivantes).includes(cible)) setCible(null);
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreurLocale(null);
    const fautes = [regle, motif.trim() ? null : "Indiquez le motif."].filter((x): x is string => Boolean(x));
    if (fautes.length > 0) {
      setErreurLocale(fautes.join(" "));
      return;
    }
    run(
      () =>
        enregistrerBudgetAction({
          propertyId,
          dateEffet,
          tranches: triees,
          cibleMinCentimes: cible,
          motif: motif.trim(),
        }),
      () => setMotif(""),
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={soumettre} noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="crm-label mb-1">Réponses proposées par le formulaire</legend>
        <label className="flex items-center gap-2 text-sm text-[var(--crm-text-dim)]">
          <input type="checkbox" checked disabled aria-describedby={`${ids}-toujours`} />
          {BUDGET_CHOICE_LABELS.aucun_projet}
          <span id={`${ids}-toujours`} className="text-[11px] text-[var(--crm-text-faint)]">
            (toujours proposée, en premier)
          </span>
        </label>
        {trierTranches(TRANCHES_BUDGET).map((t) => (
          <label key={t} className="flex items-center gap-2 text-sm text-[var(--crm-text)]">
            <input type="checkbox" checked={tranches.includes(t)} onChange={() => basculer(t)} />
            {BUDGET_CHOICE_LABELS[t]}
          </label>
        ))}
        <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
          Les tranches se suivent sans trou ni chevauchement, et la dernière est ouverte (« plus de … ») : un acheteur
          au-dessus doit avoir sa réponse. Quatre au plus.
        </p>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="crm-label">Cible : une demande vaut la peine</span>
            <select
              className="crm-select"
              value={cible ?? ""}
              onChange={(e) => setCible(e.target.value ? Number(e.target.value) : null)}
              aria-describedby={`${ids}-cible`}
            >
              <option value="" disabled>
                Choisir…
              </option>
              {cibles.map((c) => (
                <option key={c} value={c}>
                  {libelleCible(c)}
                </option>
              ))}
            </select>
          </label>
          <span id={`${ids}-cible`} className="text-[11px] text-[var(--crm-text-faint)]">
            Le bas d’une des tranches proposées. « Pas de projet » n’est jamais dans la cible.
          </span>
        </div>

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
            Le formulaire et Pilotage pub prennent le réglage dont la date d’effet est la plus récente sans dépasser
            aujourd’hui.
          </span>
        </div>
      </div>

      {!initiale && proposition ? (
        <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
          Proposition d’après {proposition.depuis === "prix_affiche" ? "le prix affiché" : "le lot le moins cher"} : à
          valider ou modifier. Rien n’est appliqué avant l’enregistrement.
        </p>
      ) : null}

      <label className="flex min-w-0 flex-col gap-1">
        <span className="crm-label">Motif</span>
        <textarea
          className="crm-textarea"
          rows={2}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="ex. Lancement du bien · Seuil validé par Victor le 28/11/2026"
          required
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        {/* « Enregistré » dès que la base a confirmé : le bouton n'attend pas
            la fin du rafraîchissement de la page, qui a déjà duré plus de
            trente secondes sur un programme (docs/05, n° 49). Il reste
            désactivé jusque-là : pas de second envoi. */}
        <button type="submit" className="crm-btn crm-btn--primaire crm-btn--sm" disabled={pending}>
          {pending && !done
            ? "Enregistrement…"
            : initiale
              ? "Enregistrer cette nouvelle version"
              : "Enregistrer le budget du formulaire"}
        </button>
        <Saved show={done} />
        {done && pending ? (
          <span className="text-[11px] text-[var(--crm-text-faint)]">La page se met à jour…</span>
        ) : null}
        <FieldError error={erreurLocale ?? error} />
      </div>
      {/* La forme de la liste se dit tout de suite ; la cible et le motif, à l'envoi. */}
      {regleTranches && !erreurLocale ? (
        <p className="crm-wrap text-xs text-[var(--crm-warning)]">{regleTranches}</p>
      ) : null}
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        Rien n’est écrasé : la version actuelle reste dans l’historique, avec sa date et son auteur. Le budget reste dans
        le site : rien n’est envoyé à Meta.
      </p>
    </form>
  );
}
