"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";

interface StepShellProps {
  question: string;
  secondary?: string;
  context?: string | null;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  submitting: boolean;
  nextLabel: string;
  submittingLabel: string;
  backLabel?: string;
  errorMessage?: string | null;
  wide?: boolean;
}

/**
 * Cadre commun d'une étape : contexte personnalisé, question (mise au focus pour
 * les lecteurs d'écran), contenu, et navigation. Un `form` permet d'avancer au
 * clavier (Entrée) ; le bouton principal est protégé contre les doubles envois.
 */
export function StepShell({
  question,
  secondary,
  context,
  children,
  onBack,
  onNext,
  canGoBack,
  submitting,
  nextLabel,
  submittingLabel,
  backLabel = "Retour",
  errorMessage,
  wide = false,
}: StepShellProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    // Amène le focus sur la question à l'arrivée sur l'étape (accessibilité).
    headingRef.current?.focus();
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onNext();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`mx-auto flex w-full flex-col ${wide ? "max-w-4xl" : "max-w-2xl"}`}
      noValidate
    >
      <div className="animate-fade">
        {context ? (
          <p className="font-display text-lg italic text-gold-soft">{context}</p>
        ) : null}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 text-balance text-3xl leading-[1.16] text-ivory outline-none sm:text-4xl"
        >
          {question}
        </h1>
        {secondary ? (
          <p className="mt-4 max-w-xl text-pretty leading-relaxed text-text-on-dark-muted">
            {secondary}
          </p>
        ) : null}
        <div className="mt-9">{children}</div>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-6 border-l-2 border-[color:var(--color-danger-on-dark)] pl-4 text-sm text-[color:var(--color-danger-on-dark)]"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-10 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack || submitting}
          className="inline-flex min-h-[2.75rem] items-center gap-2 px-2 py-2 text-sm text-text-on-dark-muted transition-colors hover:text-text-on-dark disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
        >
          <span aria-hidden="true">←</span>
          {backLabel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="group inline-flex min-h-[3rem] items-center justify-center gap-3 border border-text-on-dark bg-text-on-dark px-7 py-4 text-sm font-medium tracking-[0.01em] text-wood-black transition-colors duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
        >
          <span>{submitting ? submittingLabel : nextLabel}</span>
          {!submitting ? (
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-wood-black/30 border-t-wood-black"
            />
          )}
        </button>
      </div>
    </form>
  );
}
