"use client";

import Link from "next/link";
import { useState } from "react";
import { analysis, type RecallPreference } from "@/modules/mandates/funnel";
import type { AppreciationKey } from "@/modules/mandates/scoring";

interface PreAnalysisScreenProps {
  /** Appréciation qualitative calculée côté serveur (jamais de score numérique). */
  appreciation: AppreciationKey | null;
  recallPreference?: RecallPreference;
}

/**
 * Écran final de pré-analyse. Ne montre QUE l'appréciation qualitative : jamais
 * les deux scores internes, jamais « non éligible » — la décision finale reste
 * humaine. Le CTA ne prétend pas réserver de créneau (pas de Calendar).
 */
export function PreAnalysisScreen({
  appreciation,
  recallPreference,
}: PreAnalysisScreenProps) {
  const t = analysis.preAnalysis;
  const [requested, setRequested] = useState(false);

  const appreciationLabel = appreciation
    ? t.appreciationLabels[appreciation]
    : null;

  const recallLabel = recallPreference
    ? analysis.steps.contact.recallOptions.find(
        (o) => o.value === recallPreference,
      )?.label
    : null;

  return (
    <div className="mx-auto max-w-2xl animate-fade-up">
      {/* Panneau OPAQUE (« dossier ») — comme les étapes du quiz : le texte ne
          flotte jamais directement sur la photo (lisibilité garantie). */}
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border-dark)] bg-[color:var(--color-onyx-soft)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-sm sm:p-8 lg:p-10">
      <p className="eyebrow text-gold-soft">{t.eyebrow}</p>
      <h1 className="mt-6 text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl md:text-[2.6rem]">
        {t.title}
      </h1>

      {/* Appréciation qualitative — seul résultat visible (aucun score chiffré).
          Fond doré discret pour ressortir sur le panneau onyx. */}
      {appreciationLabel ? (
        <div className="mt-7 inline-flex items-center gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-gold)]/40 bg-[color:var(--color-gold)]/10 px-5 py-3">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full bg-gold"
          />
          <span className="font-display text-xl text-ivory sm:text-2xl">
            {appreciationLabel}
          </span>
        </div>
      ) : null}

      <p className="mt-7 text-pretty leading-relaxed text-text-on-dark-muted">
        {t.text}
      </p>

      {/* Prochaine étape — entretien d'éligibilité */}
      <div className="mt-10 border-t border-[color:var(--color-border-dark)] pt-8">
        <h2 className="text-xl text-ivory sm:text-2xl">{t.nextStepTitle}</h2>
        <ul className="mt-5 space-y-3">
          {t.nextStepPoints.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-gold"
              />
              <span className="text-[0.975rem] leading-relaxed text-ivory/90">
                {point}
              </span>
            </li>
          ))}
        </ul>

        {recallLabel ? (
          <p className="mt-6 text-sm text-text-on-dark-muted">
            {t.recallEcho}{" "}
            <span className="text-ivory">{recallLabel.toLowerCase()}</span>.
          </p>
        ) : null}

        {/* CTA — n'affirme aucune réservation de créneau (honnêteté : pas de Calendar). */}
        {requested ? (
          <div
            className="mt-8 border-l-2 border-gold pl-5"
            role="status"
            aria-live="polite"
          >
            <p className="font-display text-lg text-ivory">
              {t.ctaConfirmedTitle}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-text-on-dark-muted">
              {t.ctaConfirmedText}
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setRequested(true)}
              className="group inline-flex min-h-[3rem] items-center justify-center gap-3 border border-text-on-dark bg-text-on-dark px-7 py-4 text-sm font-medium tracking-[0.01em] text-wood-black transition-colors duration-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
            >
              <span>{t.cta}</span>
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                →
              </span>
            </button>
          </div>
        )}
      </div>
      </div>

      <div className="mt-8">
        <Link
          href="/proprietaire"
          className="inline-flex min-h-[3rem] items-center gap-2 border border-[color:var(--color-border-strong-dark)] bg-[color:var(--color-onyx-soft)]/70 px-6 py-3 text-sm text-text-on-dark backdrop-blur-sm transition-colors hover:border-text-on-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
        >
          <span aria-hidden="true">←</span>
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}
