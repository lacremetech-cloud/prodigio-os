"use client";

import Image from "next/image";
import Link from "next/link";
import { media, type MediaAsset } from "@/lib/media";
import {
  analysis,
  MANDATE_SITUATIONS,
  mandateSituationLabels,
  propertyTypeLabels,
  SALE_HORIZONS,
  saleHorizonLabels,
  VALUE_BANDS,
  valueBandLabels,
} from "@/modules/mandates/funnel";
import { ChoiceCardGrid } from "./choice-card-grid";
import { ConfirmationScreen } from "./confirmation-screen";
import { ContactFields } from "./contact-fields";
import { IntroScreen } from "./intro-screen";
import { LocationFields } from "./location-fields";
import { OptionList } from "./option-list";
import { ProgressRail } from "./progress-rail";
import { StepShell } from "./step-shell";
import { locatedPhrase, propertyLabel, valuePhrase } from "./personalize";
import {
  CONFIRMATION_STEP,
  INTRO_STEP,
  LAST_STEP,
  useAnalyseMachine,
  type DraftAnswers,
} from "./use-analyse-machine";

const valueOptions = VALUE_BANDS.map((v) => ({ value: v, label: valueBandLabels[v] }));
const horizonOptions = SALE_HORIZONS.map((v) => ({
  value: v,
  label: saleHorizonLabels[v],
}));
const situationOptions = MANDATE_SITUATIONS.map((v) => ({
  value: v,
  label: mandateSituationLabels[v],
}));

/** Fond d'ambiance selon l'étape et les réponses (continuité visuelle). */
function backgroundFor(step: number, draft: DraftAnswers): MediaAsset {
  if (step === CONFIRMATION_STEP) return media.confirmation;
  if (step === INTRO_STEP) return media.ambiance1;
  if (draft.propertyType) return media[propertyTypeLabels[draft.propertyType].image];
  return step % 2 === 0 ? media.ambiance2 : media.ambiance1;
}

/** Ligne de contexte personnalisée, discrète, selon l'avancement. */
function contextFor(step: number, draft: DraftAnswers): string | null {
  if (step === 5 || step === 6) return valuePhrase(draft.valueBand) ?? locatedPhrase(draft);
  if (step >= 3) return locatedPhrase(draft);
  if (step === 2) return propertyLabel(draft.propertyType);
  return null;
}

/**
 * Expérience immersive d'analyse d'éligibilité (plein écran). Une question par
 * écran, progression discrète, transitions douces, reprise sans perte, clavier
 * accessible, protection contre les doubles soumissions.
 */
export function AnalyseExperience() {
  const m = useAnalyseMachine();
  const bg = backgroundFor(m.step, m.draft);
  const showProgress = m.step >= 1 && m.step <= LAST_STEP;
  const isConfirmation = m.step === CONFIRMATION_STEP;
  const submissionError = m.status === "error" ? m.errorMessage : null;

  if (!m.hydrated) {
    return <div className="min-h-dvh bg-onyx" aria-hidden="true" />;
  }

  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-onyx text-ivory">
      {/* Fond photographique (crossfade par changement de clé) */}
      <Image
        key={bg.src}
        src={bg.src}
        alt=""
        aria-hidden="true"
        fill
        priority={m.step === INTRO_STEP}
        sizes="100vw"
        className="-z-20 animate-fade object-cover"
      />
      <div
        aria-hidden="true"
        className="-z-10 absolute inset-0"
        style={{
          backgroundImage: isConfirmation
            ? "linear-gradient(180deg, rgba(12,12,14,0.66) 0%, rgba(12,12,14,0.86) 100%)"
            : "var(--overlay-immersive)",
        }}
      />

      <div className="relative flex min-h-dvh flex-col">
        {/* En-tête */}
        <header className="flex items-center justify-between px-5 pt-5 sm:px-10 sm:pt-7 lg:px-14">
          <Link
            href="/proprietaire"
            className="font-signature inline-flex min-h-[2.75rem] items-center py-2 text-sm font-semibold tracking-[0.28em] text-text-on-dark transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
          >
            PRODIGIO
          </Link>
          {!isConfirmation ? (
            <Link
              href="/proprietaire"
              className="inline-flex min-h-[2.75rem] items-center px-1 py-2 text-xs uppercase tracking-[0.18em] text-text-on-dark-muted transition-colors hover:text-text-on-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
            >
              Quitter
            </Link>
          ) : null}
        </header>

        {/* Progression */}
        {showProgress ? (
          <div className="mx-auto mt-7 w-full max-w-2xl px-6 sm:px-10 lg:px-0">
            <ProgressRail step={m.step} />
          </div>
        ) : null}

        {/* Contenu */}
        <main className="flex flex-1 items-center px-6 py-12 sm:px-10 lg:px-14">
          <div className="w-full" key={m.step}>
            {m.step === INTRO_STEP ? <IntroScreen onStart={m.start} /> : null}

            {m.step === 1 ? (
              <StepShell
                wide
                question={analysis.steps.propertyType.question}
                onBack={m.goBack}
                onNext={m.goNext}
                canGoBack
                backLabel="Retour à l'introduction"
                submitting={false}
                nextLabel="Continuer"
                submittingLabel={analysis.submitting}
              >
                <ChoiceCardGrid
                  selected={m.draft.propertyType}
                  onSelect={(v) => m.patch({ propertyType: v })}
                  error={m.errors.propertyType}
                />
              </StepShell>
            ) : null}

            {m.step === 2 ? (
              <StepShell
                question={analysis.steps.location.question}
                secondary={analysis.steps.location.secondary}
                context={contextFor(2, m.draft)}
                onBack={m.goBack}
                onNext={m.goNext}
                canGoBack
                submitting={false}
                nextLabel="Continuer"
                submittingLabel={analysis.submitting}
              >
                <LocationFields
                  value={m.draft.location}
                  onChange={m.patchLocation}
                  errors={m.errors}
                />
              </StepShell>
            ) : null}

            {m.step === 3 ? (
              <StepShell
                question={analysis.steps.valueBand.question}
                context={contextFor(3, m.draft)}
                onBack={m.goBack}
                onNext={m.goNext}
                canGoBack
                submitting={false}
                nextLabel="Continuer"
                submittingLabel={analysis.submitting}
              >
                <OptionList
                  ariaLabel={analysis.steps.valueBand.question}
                  options={valueOptions}
                  selected={m.draft.valueBand}
                  onSelect={(v) => m.patch({ valueBand: v })}
                  error={m.errors.valueBand}
                />
              </StepShell>
            ) : null}

            {m.step === 4 ? (
              <StepShell
                question={analysis.steps.saleHorizon.question}
                context={contextFor(4, m.draft)}
                onBack={m.goBack}
                onNext={m.goNext}
                canGoBack
                submitting={false}
                nextLabel="Continuer"
                submittingLabel={analysis.submitting}
              >
                <OptionList
                  ariaLabel={analysis.steps.saleHorizon.question}
                  options={horizonOptions}
                  selected={m.draft.saleHorizon}
                  onSelect={(v) => m.patch({ saleHorizon: v })}
                  error={m.errors.saleHorizon}
                />
              </StepShell>
            ) : null}

            {m.step === 5 ? (
              <StepShell
                question={analysis.steps.mandateSituation.question}
                context={contextFor(5, m.draft)}
                onBack={m.goBack}
                onNext={m.goNext}
                canGoBack
                submitting={false}
                nextLabel="Continuer"
                submittingLabel={analysis.submitting}
              >
                <OptionList
                  ariaLabel={analysis.steps.mandateSituation.question}
                  options={situationOptions}
                  selected={m.draft.mandateSituation}
                  onSelect={(v) => m.patch({ mandateSituation: v })}
                  error={m.errors.mandateSituation}
                />
              </StepShell>
            ) : null}

            {m.step === 6 ? (
              <StepShell
                question={analysis.steps.contact.title}
                secondary={analysis.steps.contact.text}
                context={contextFor(6, m.draft)}
                onBack={m.goBack}
                onNext={m.goNext}
                canGoBack
                submitting={m.status === "submitting"}
                nextLabel={analysis.submitCta}
                submittingLabel={analysis.submitting}
                errorMessage={submissionError}
              >
                <ContactFields
                  value={m.draft.contact}
                  onChange={m.patchContact}
                  errors={m.errors}
                  honeypot={m.draft.company}
                  onHoneypotChange={(v) => m.patch({ company: v })}
                />
              </StepShell>
            ) : null}

            {isConfirmation ? <ConfirmationScreen draft={m.draft} /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
