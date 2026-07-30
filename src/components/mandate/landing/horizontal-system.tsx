"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { media, type MediaAsset } from "@/lib/media";
import { SectionMarker } from "./section-marker";
import { systeme } from "./copy";

/** Détails visuels par phase (l'ordre suit `systeme.phases`). */
const VISUALS: { media: MediaAsset; keywords: string[]; example: string }[] = [
  {
    media: media.ambiance1,
    keywords: ["Acheteur idéal", "Marché", "Déclencheurs"],
    example: "Qui achète ce bien, où vit-il, et ce qui provoque le déclic.",
  },
  {
    media: media.ecrinIdentite,
    keywords: ["Stratégie", "Angles de désir", "Récit"],
    example: "Le bien devient une marque : une identité, pas une fiche.",
  },
  {
    media: media.ecrinBrochureCover,
    keywords: ["Film", "Photographie", "Site dédié"],
    example: "Un écrin éditorial complet — 1 bien, 1 univers.",
  },
  {
    media: media.ecrinPublicites,
    keywords: ["France & étranger", "Ciblage", "Qualification"],
    example: "On va chercher l'acheteur, puis on qualifie avant la visite.",
  },
];

const DEFAULT_VISUAL = {
  media: media.ambiance1,
  keywords: [] as string[],
  example: "",
};

const phases = systeme.phases.map((p, i) => {
  const v = VISUALS[i] ?? DEFAULT_VISUAL;
  return { ...p, media: v.media, keywords: v.keywords, example: v.example };
});

function usePinnedEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mqWide = window.matchMedia("(min-width: 1024px)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(mqWide.matches && !mqMotion.matches);
    update();
    mqWide.addEventListener("change", update);
    mqMotion.addEventListener("change", update);
    return () => {
      mqWide.removeEventListener("change", update);
      mqMotion.removeEventListener("change", update);
    };
  }, []);
  return enabled;
}

export function HorizontalSystem() {
  const enabled = usePinnedEnabled();
  const outerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const outer = outerRef.current;
    const track = trackRef.current;
    if (!outer || !track) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const total = outer.offsetHeight - window.innerHeight;
      const p = total > 0 ? Math.min(Math.max(-outer.getBoundingClientRect().top / total, 0), 1) : 0;
      setProgress(p);
      const maxShift = track.scrollWidth - window.innerWidth;
      track.style.transform = `translate3d(${(-p * maxShift).toFixed(1)}px, 0, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  const activeIndex = Math.min(phases.length - 1, Math.round(progress * (phases.length - 1)));

  // --- Version pin + scroll horizontal (desktop, mouvement autorisé) ---
  if (enabled) {
    return (
      <section
        ref={outerRef}
        aria-label="Le Système Prodigio en quatre phases"
        className="relative bg-onyx text-ivory"
        style={{ height: `${phases.length * 100}vh` }}
      >
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          {/* En-tête */}
          <div className="px-10 pt-10 lg:px-16">
            <SectionMarker index={systeme.index} label={systeme.kicker} tone="light" />
          </div>

          {/* Piste horizontale */}
          <div ref={trackRef} className="flex flex-1 will-change-transform">
            {phases.map((phase) => (
              <article
                key={phase.n}
                className="flex h-full w-screen shrink-0 items-center gap-14 px-10 lg:px-16"
              >
                <div className="w-[42%]">
                  <span className="font-display text-6xl text-gold-soft xl:text-7xl">
                    {phase.n}
                  </span>
                  <p className="mt-5 font-signature text-xs uppercase tracking-[0.24em] text-text-on-dark-muted">
                    {phase.lead}
                  </p>
                  <h3 className="mt-3 text-4xl text-ivory xl:text-5xl">{phase.title}</h3>
                  <p className="mt-6 max-w-md text-pretty text-lg leading-relaxed text-text-on-dark-muted">
                    {phase.text}
                  </p>
                  <ul className="mt-7 flex flex-wrap gap-2">
                    {phase.keywords.map((k) => (
                      <li
                        key={k}
                        className="border border-border-strong-dark px-3 py-1 text-xs text-ivory/85"
                      >
                        {k}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-7 max-w-md border-l border-[color:var(--color-gold-soft)] pl-4 text-sm italic text-ivory/75">
                    {phase.example}
                  </p>
                </div>
                <div className="relative aspect-[4/5] h-[62vh] w-[52%] overflow-hidden border border-border-dark shadow-[var(--shadow-lg)]">
                  <Image
                    src={phase.media.src}
                    alt={phase.media.alt}
                    fill
                    sizes="52vw"
                    className="object-cover"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,12,14,0)_55%,rgba(12,12,14,0.6)_100%)]" />
                </div>
              </article>
            ))}
          </div>

          {/* Barre de progression + jalons */}
          <div className="px-10 pb-10 lg:px-16">
            <div className="flex items-center gap-4">
              <div className="relative h-px flex-1 bg-border-strong-dark">
                <span
                  className="absolute inset-y-0 left-0 bg-gold-soft"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="flex gap-3">
                {phases.map((phase, i) => (
                  <span
                    key={phase.n}
                    className={`font-signature text-xs tracking-[0.2em] transition-colors ${i === activeIndex ? "text-gold-soft" : "text-text-on-dark-muted/50"}`}
                  >
                    {phase.n}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // --- Fallback vertical (mobile / mouvement réduit / sans JS) ---
  return (
    <section className="bg-onyx px-6 py-24 text-ivory sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <SectionMarker index={systeme.index} label={systeme.kicker} tone="light" />
        <h2 className="mt-7 max-w-3xl text-balance text-3xl leading-[1.16] text-ivory sm:text-4xl">
          {systeme.titleLine1}{" "}
          <span className="text-gold-soft">{systeme.titleLine2}</span>
        </h2>
        <ol className="mt-14 space-y-14">
          {phases.map((phase) => (
            <li key={phase.n} className="grid gap-6 sm:grid-cols-2 sm:items-center sm:gap-10">
              <div>
                <span className="font-display text-5xl text-gold-soft">{phase.n}</span>
                <p className="mt-4 font-signature text-[0.66rem] uppercase tracking-[0.24em] text-text-on-dark-muted">
                  {phase.lead}
                </p>
                <h3 className="mt-2 text-2xl text-ivory">{phase.title}</h3>
                <p className="mt-4 text-pretty leading-relaxed text-text-on-dark-muted">
                  {phase.text}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {phase.keywords.map((k) => (
                    <li key={k} className="border border-border-strong-dark px-3 py-1 text-xs text-ivory/85">
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative aspect-[4/3] w-full overflow-hidden border border-border-dark shadow-[var(--shadow-md)]">
                <Image
                  src={phase.media.src}
                  alt={phase.media.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
