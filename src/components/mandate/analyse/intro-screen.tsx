"use client";

import { analysis } from "@/modules/mandates/funnel";

interface IntroScreenProps {
  onStart: () => void;
}

/** Écran d'introduction de l'analyse : cadre, ton sélectif, appel à commencer. */
export function IntroScreen({ onStart }: IntroScreenProps) {
  const t = analysis.intro;
  return (
    <div className="mx-auto max-w-2xl animate-fade-up text-center">
      <p className="eyebrow text-gold-soft">{t.eyebrow}</p>
      <h1 className="mt-6 text-balance text-4xl leading-[1.12] text-ivory sm:text-5xl">
        {t.title}
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-pretty leading-relaxed text-text-on-dark-muted">
        {t.text}
      </p>
      <div className="mt-10 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={onStart}
          className="group inline-flex min-h-[3rem] items-center justify-center gap-3 border border-text-on-dark bg-text-on-dark px-8 py-4 text-sm font-medium tracking-[0.01em] text-wood-black transition-colors duration-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
        >
          <span>{t.cta}</span>
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-1"
          >
            →
          </span>
        </button>
        <p className="text-sm text-text-on-dark-muted">{t.reassurance}</p>
      </div>
    </div>
  );
}
