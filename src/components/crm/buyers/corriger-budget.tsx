"use client";

import { useState } from "react";
import { corrigerBudgetAction } from "@/modules/buyers/crm/actions";
import { FieldError, Saved, useAction } from "@/components/crm/property/shared";
import { BUDGET_CHOICE_COURT, type BuyerBudgetChoice } from "@/modules/buyers/funnel/universal";

/**
 * CORRIGER UN BUDGET MAL DÉCLARÉ.
 *
 * Le cas vient d'Yves GUENIN, le 2 novembre : il avait coché
 * « 500 000 € – 1 M€ » pour un projet au-dessus du million. Quelqu'un se
 * trompe de case, ou dit au téléphone autre chose que ce qu'il a coché à 23 h
 * sur son portable — et jusqu'ici il n'existait aucun moyen de le corriger.
 *
 * CE QU'IL A DÉCLARÉ RESTE ÉCRIT. On ne remplace pas sa réponse, on pose à
 * côté ce que l'équipe retient. Les deux sont affichés ici, et c'est la
 * correction que lisent les filtres, le pipeline et les récapitulatifs.
 *
 * Ouvert à tous ceux qui traitent les dossiers, commerciaux compris : celui
 * qui a eu la personne au téléphone est celui qui sait que la case est fausse.
 * La base applique la même règle (`crm_buyer_can_operate`).
 */

/** Les trois réponses que le formulaire pose aujourd'hui. */
const PROPOSEES: BuyerBudgetChoice[] = ["aucun_projet", "500k_1m", "plus_1m"];

export function CorrigerBudget({
  buyerProfileId,
  declare,
  corrige,
  motif,
}: {
  buyerProfileId: string;
  /** Ce que la personne a répondu au formulaire. */
  declare: string | null;
  /** La correction en place, s'il y en a une. */
  corrige: string | null;
  motif: string | null;
}) {
  const { pending, error, done, run } = useAction();
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState<string>(corrige ?? declare ?? "");
  const [raison, setRaison] = useState(motif ?? "");

  const libelle = (v: string | null) =>
    v ? (BUDGET_CHOICE_COURT[v as BuyerBudgetChoice] ?? v) : "Non renseigné";

  /* Les tranches retirées du formulaire (1–2 M€…) ne sont pas proposées, mais
     si un dossier en porte une, elle doit rester choisissable — sinon le
     sélecteur afficherait du vide sur une valeur qui existe. */
  const options = Array.from(
    new Set([...PROPOSEES, ...(declare ? [declare] : []), ...(corrige ? [corrige] : [])]),
  );

  if (!ouvert) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--crm-text)]">{libelle(corrige ?? declare)}</span>
        {corrige ? (
          <span className="text-xs text-[var(--crm-text-dim)]">
            corrigé — déclaré&nbsp;: {libelle(declare)}
          </span>
        ) : null}
        <button
          type="button"
          className="crm-btn crm-btn--sm crm-btn--ghost"
          onClick={() => setOuvert(true)}
        >
          {corrige ? "Modifier" : "Corriger"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[var(--crm-text-dim)]">
        Réponse au formulaire&nbsp;: <strong>{libelle(declare)}</strong>. Elle reste conservée —
        la correction s’affiche à sa place dans les listes, le pipeline et les récapitulatifs.
      </p>

      <label className="flex flex-col gap-1">
        <span className="crm-label">Budget retenu</span>
        <select
          className="crm-select"
          value={choix}
          onChange={(e) => setChoix(e.target.value)}
        >
          {options.map((v) => (
            <option key={v} value={v}>
              {libelle(v)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="crm-label">Motif (facultatif)</span>
        <input
          className="crm-input"
          value={raison}
          maxLength={2000}
          placeholder="S’est trompé de case, l’a dit au téléphone…"
          onChange={(e) => setRaison(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="crm-btn crm-btn--sm crm-btn--primaire"
          disabled={pending || !choix}
          onClick={() =>
            run(
              () =>
                corrigerBudgetAction({
                  buyerProfileId,
                  /* Rechoisir la déclaration RETIRE la correction plutôt que
                     d'enregistrer une correction identique : sans ça, la fiche
                     annoncerait « corrigé » pour une valeur que personne n'a
                     changée. */
                  budgetChoice: choix === declare ? null : choix,
                  motif: choix === declare ? null : raison.trim() || null,
                }),
              () => setOuvert(false),
            )
          }
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>

        {corrige ? (
          <button
            type="button"
            className="crm-btn crm-btn--sm crm-btn--ghost"
            disabled={pending}
            onClick={() =>
              run(
                () => corrigerBudgetAction({ buyerProfileId, budgetChoice: null, motif: null }),
                () => setOuvert(false),
              )
            }
          >
            Rendre la déclaration
          </button>
        ) : null}

        <button
          type="button"
          className="crm-btn crm-btn--sm crm-btn--ghost"
          disabled={pending}
          onClick={() => {
            setOuvert(false);
            setChoix(corrige ?? declare ?? "");
            setRaison(motif ?? "");
          }}
        >
          Annuler
        </button>
        <Saved show={done} />
      </div>
      <FieldError error={error} />
    </div>
  );
}
