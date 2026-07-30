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
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Amène le focus sur la question à l'arrivée sur l'étape (accessibilité).
    headingRef.current?.focus();
  }, []);

  // Dès qu'un message d'erreur de soumission apparaît, on l'amène clairement à
  // l'écran (défilement doux) et on y place le focus : aucune erreur ne doit
  // rester silencieuse ou hors du champ de vision, surtout sur mobile où le
  // bouton est en bas d'un long formulaire.
  useEffect(() => {
    if (!errorMessage) return;
    const node = errorRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    // Le focus vient après le défilement (évite un saut brusque).
    const id = window.setTimeout(() => node.focus(), 120);
    return () => window.clearTimeout(id);
  }, [errorMessage]);

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
      {/* Panneau OPAQUE (« dossier ») — le contenu ne flotte jamais sur la photo. */}
      <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border-dark)] bg-[color:var(--color-onyx-soft)] p-6 shadow-[var(--shadow-lg)] backdrop-blur-sm sm:p-8 lg:p-10">
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
          <div
            ref={errorRef}
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
            className="animate-fade mt-8 flex items-start gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-danger-on-dark)]/45 bg-[color:var(--color-danger-on-dark)]/10 p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-danger-on-dark)] sm:p-5"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-danger-on-dark)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16.5h.01" />
            </svg>
            <div className="min-w-0">
              <p className="font-signature text-xs uppercase tracking-[0.18em] text-[color:var(--color-danger-on-dark)]">
                Envoi non abouti
              </p>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-text-on-dark">
                {errorMessage}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-10 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack || submitting}
            className="inline-flex min-h-[3rem] items-center gap-2 px-2 py-2 text-sm text-text-on-dark-muted transition-colors hover:text-text-on-dark disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
          >
            <span aria-hidden="true">←</span>
            {backLabel}
          </button>
          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="cta-shine group relative inline-flex min-h-[3.5rem] items-center justify-center gap-3 bg-[color:var(--color-gold-soft)] px-8 py-4 text-[0.95rem] font-semibold tracking-[0.01em] text-wood-black transition-colors duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
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
      </div>
    </form>
  );
}
