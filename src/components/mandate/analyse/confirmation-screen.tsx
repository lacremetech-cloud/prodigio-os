"use client";

import Link from "next/link";
import {
  analysis,
  mandateSituationLabels,
  propertyTypeLabels,
  saleHorizonLabels,
  valueBandLabels,
} from "@/modules/mandates/funnel";
import { locatedPhrase } from "./personalize";
import type { DraftAnswers } from "./use-analyse-machine";

interface ConfirmationScreenProps {
  draft: DraftAnswers;
}

/**
 * Écran de confirmation : accusé de réception soigné + récapitulatif élégant.
 * Aucune confirmation générique, aucun délai de rappel promis.
 */
export function ConfirmationScreen({ draft }: ConfirmationScreenProps) {
  const t = analysis.confirmation;
  const context = locatedPhrase(draft);

  const location = [
    draft.location.city,
    draft.location.postalCode,
    draft.location.country,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  const rows: { label: string; value: string | null }[] = [
    {
      label: "Propriété",
      value: draft.propertyType
        ? propertyTypeLabels[draft.propertyType].label
        : null,
    },
    { label: "Localisation", value: location || null },
    {
      label: "Valeur estimée",
      value: draft.valueBand ? valueBandLabels[draft.valueBand] : null,
    },
    {
      label: "Horizon de vente",
      value: draft.saleHorizon ? saleHorizonLabels[draft.saleHorizon] : null,
    },
    {
      label: "Situation actuelle",
      value: draft.mandateSituation
        ? mandateSituationLabels[draft.mandateSituation]
        : null,
    },
    {
      label: "Interlocuteur",
      value:
        `${draft.contact.firstName} ${draft.contact.lastName}`.trim() || null,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      <p className="eyebrow text-gold-soft">{t.eyebrow}</p>
      <h1 className="mt-6 text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl md:text-[2.6rem]">
        {t.title}
      </h1>
      {context ? (
        <p className="mt-4 font-display text-xl italic text-gold-soft">
          {context}.
        </p>
      ) : null}
      <p className="mt-6 text-pretty leading-relaxed text-text-on-dark-muted">
        {t.text}
      </p>

      <div className="mt-10 border border-[color:var(--color-border-dark)] bg-[color:var(--color-onyx-soft)]/60 p-6 sm:p-8">
        <p className="eyebrow text-[0.68rem] text-gold-soft">{t.recapTitle}</p>
        <dl className="mt-5 divide-y divide-[color:var(--color-border-dark)]">
          {rows
            .filter((row) => row.value)
            .map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <dt className="text-xs uppercase tracking-[0.16em] text-text-on-dark-muted">
                  {row.label}
                </dt>
                <dd className="text-[0.975rem] text-ivory sm:text-right">
                  {row.value}
                </dd>
              </div>
            ))}
        </dl>
      </div>

      <div className="mt-10">
        <Link
          href="/proprietaire"
          className="inline-flex min-h-[3rem] items-center gap-2 border border-[color:var(--color-border-strong-dark)] px-6 py-3 text-sm text-text-on-dark transition-colors hover:border-text-on-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
        >
          <span aria-hidden="true">←</span>
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}
